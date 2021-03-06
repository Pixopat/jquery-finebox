/*global jQuery: false, log: true */
/*jslint browser: true, plusplus: true, devel: true */

(function ($) {
    'use strict';

    // Adds inView selector
    $.extend($.expr[':'], {
        inView: function (a) {
            var st = (document.documentElement.scrollTop || document.body.scrollTop),
                ot = Math.round($(a).offset().top),
                wh = (window.innerHeight && window.innerHeight < $(window).height()) ? window.innerHeight : $(window).height();
            return !(ot > (wh - st) || ($(a).height() + ot) < st);
        },
        scrollable: function (element, index, meta, stack) {
            
            try {            
                var converter = {
                		vertical: { x: false, y: true },
                		horizontal: { x: true, y: false },
                		both: { x: true, y: true },
                		x: { x: true, y: false },
                		y: { x: false, y: true }
                	},
                	scrollValue = {
                		auto: true,
                		scroll: true,
                		visible: false,
                		hidden: false
                	},
            	    rootrx = /^(?:html)$/i,
                    direction = converter[typeof (meta[3]) === "string" && meta[3].toLowerCase()] || converter.both,
                    styles = (document.defaultView && document.defaultView.getComputedStyle ? document.defaultView.getComputedStyle(element, null) : element.currentStyle),
                    overflow = {
                        x: scrollValue[styles.overflowX.toLowerCase()] || false,
                        y: scrollValue[styles.overflowY.toLowerCase()] || false,
                        isRoot: rootrx.test(element.nodeName)
                    };

                // check if completely unscrollable (exclude HTML element because it's special)
                if (!overflow.x && !overflow.y && !overflow.isRoot){
                    return false;
                }
                var size = {
                    height: {
                        scroll: element.scrollHeight,
                        client: element.clientHeight
                    },
                    width: {
                        scroll: element.scrollWidth,
                        client: element.clientWidth
                    },
                    // check overflow.x/y because iPad (and possibly other tablets) don't dislay scrollbars
                    scrollableX: function () {
                        return (overflow.x || overflow.isRoot) && this.width.scroll > this.width.client;
                    },
                    scrollableY: function () {
                        return (overflow.y || overflow.isRoot) && this.height.scroll > this.height.client;
                    }
                };
                return direction.y && size.scrollableY() || direction.x && size.scrollableX();
            } catch (e) {
                $.error(':scrollable selector error: %o', e);
            }

        }
    });

    // Indicator class
    function Indicator($parent) {
        this.$indicator = $('<span/>', {
            'class': 'indicator',
            'style': 'display: block; position: absolute; top: 0; left: 0; right: 0; bottom: 0; background-position: center center;'
            // 'style': 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background-position: center center;'
        });
        this.$parent = $parent;
        //$parent.css('position') === 'static' && $parent.css('position', 'relative');
    }
    Indicator.prototype.add = function (cssObj) {
        this.$indicator.hide().css(cssObj).prependTo(this.$parent.children(':first')).fadeTo('fast', 0.75);
        // this.$indicator.hide().css(cssObj).prependTo(this.$parent).fadeTo('fast', 0.75);
    };
    Indicator.prototype.remove = function () {
        this.$indicator.fadeOut('fast').remove();
    };

    // fineBox object declaration
    var fineBox = {

        // Misc vars (flags, etc.)
        isLoaded: false,
        isLoading: false,
        isOpened: false,
        isOpening: false,
        enableSlideShow: false,
        isIE: jQuery.browser.msie,
        isIE6: (jQuery.browser.msie && jQuery.browser.version < 7),

        // Cached jQ objects
        $current : {},
        $overlay : {},
        $wrapper : {},
        $container : {},

        hook : function (fn) {
            // ;;; log('hook', this, arguments, fn, typeof fineBox.publics[fn], typeof fineBox[fn]);

            if (fn && typeof fn === 'string') {
                if (fineBox.publics[fn] && typeof fineBox.publics[fn] === 'function') {
                    return fineBox.publics[fn].apply(this, Array.prototype.slice.call(arguments, 1));
                } else if (fineBox[fn] && typeof fineBox[fn] === 'function') {
                    return fineBox[fn].apply(this, Array.prototype.slice.call(arguments, 1));
                }
            }
        },

        isImage : function (url) {
            return (/\.(gif|png|jpg|jpeg|bmp)(?:\?([^#]*))?(?:#(\.*))?$/i).test(url);
        },
        
        isMovie : function (url) {
            return (/\.(mp4|mkv|m4v|mov)(?:\?([^#]*))?(?:#(\.*))?$/i).test(url);
        },

        fixIELacks : function () {
            // ;;; log('fixIELacks', this, arguments);

            // Implements Array.indexOf method
            if (!Array.indexOf) {
                Array.prototype.indexOf = function (obj, start) {
                    var i;
                    for (i = (start || 0); i < this.length; i++) {
                        if (this[i] === obj) {
                            return i;
                        }
                    }
                    return -1;
                };
            }

            // Fix body height
            if (fineBox.isIE6) {
                $('body').css('height', '100%');
            }
        },

        setMessage : function (message, level, $parent) {
            // ;;; log('setMessage', this, arguments);

            var options = fineBox.$current.data('fineBox').options;
            $('<div/>', {
                'class': options.prefix + '-message',
                'style': 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; text-align: center; line-height: ' + $parent.height() + 'px;'
            }).html('<span class="' + options.prefix + '-' + level + '">' + message + '</span>').hide().prependTo($parent).fadeIn('fast', function () {
                $(this).delay(options.messageDelay).fadeOut('slow', function () {
                    $(this).remove();
                });
            });
        },

        getBiggestInFragment : function ($fragment) {
            // ;;; log('getBiggestInFragment', this, arguments);

            var maxW = 0,
                $this,
                $img;

            $('img', $fragment).each(function () {
                $this = $(this);
                maxW = Math.max(maxW, $this.width());
                if ($this.width() >= maxW) {
                    $img = $this;
                }
            });

            if ($img) {
                return $img;
            }

            return $fragment;
        },

        freezeWindowScroll : function () {
            // ;;; log('freezeWindowScroll', this, arguments, $('body').width(), $('html').width());

            // $('body').css('width', document.documentElement.clientWidth);
            // $('html').css({
            //     'overflow': 'hidden',
            //     'max-height': '100%'
            // }).scrollTop(fineBox.$overlay.data('fineBox').scrollY).scrollLeft(fineBox.$overlay.data('fineBox').scrollX);
            // 
            // if (typeof fineBox.$overlay.data('fineBox').options.hookFreezeWindowScroll === 'function') {
            //     fineBox.$overlay.data('fineBox').options.hookFreezeWindowScroll.apply(fineBox, [fineBox.$overlay.data('fineBox')]);
            // }

        },

        unfreezeWindowScroll : function () {
             // ;;; log('unfreezeWindowScroll', this, arguments, $('body').width(), $('html').width());

            // $('body').css('width', '100%');
            // $('html').css({
            //     'overflow': 'auto',
            //     'max-height': 'none',
            //     'width': '100%'
            // }).add('body').scrollTop(fineBox.$overlay.data('fineBox').scrollY).scrollLeft(fineBox.$overlay.data('fineBox').scrollX);
            // 
            // if (typeof fineBox.$overlay.data('fineBox').options.hookUnfreezeWindowScroll === 'function') {
            //     fineBox.$overlay.data('fineBox').options.hookUnfreezeWindowScroll.apply(fineBox, [fineBox.$overlay.data('fineBox')]);
            // }

        },

        init : function (userOptions) {
            // ;;; log('init', this, arguments);

            var options = {
                    'transitionMode': 'full', // Transition mode : full or minimal
                    'filter': 'div:first-child',
                    'infosSelector': '.datas',
                    'prefix': 'finebox',
                    'loop': false,
                    'messageDelay': 3000,
                    'overlayOpacity': 0.75,
                    'selector': this.selector,
                    'easingIn': 'linear',
                    'easingOut': 'linear',
                    'durationIn': 200,
                    'durationOut': 200,
                    'hookInit': null,
                    'hookAlterOverlayData': null,
                    'hookOnOpen': null,
                    'hookOnClose': null,
                    'hookFreezeWindowScroll': null,
                    'hookUnfreezeWindowScroll': null,
                    'hookAdjust': null,
                    'hookPager': null,
                    'hookAlterUriToOpen': null,
                    'viewportSpace': 40,
                    'strings': {
                        'prev': 'Previous',
                        'next': 'Next',
                        'loadNext': 'Loading next&hellip;',
                        'loadError': 'not found'
                    },
                    'slideshow': true,
                    'interval': 5000
                },
                console = window.console || null;

            // Error console
            if (console) {
                $.error = console.error;
            } else {
                $.error = function () {
                    return;
                };
                // Poor ie lower than 9 debugging
                // $.error = window.alert;
            }

            // Easing plugin requirement
            $.easing = $.easing || {};
            userOptions = userOptions || {};
            if (userOptions.easingIn && !$.easing.hasOwnProperty(userOptions.easingIn)) {
                $.error('To use ' +  userOptions.easingIn + ' easing method, jQuery.fineBox require jQuery.easing plugin. \nDownload it @url http://plugins.jquery.com/project/Easing');
                delete userOptions.easingIn;
            }
            if (userOptions.easingIn && !$.easing.hasOwnProperty(userOptions.easingOut)) {
                $.error('To use ' +  userOptions.easingOut + ' easing method, jQuery.fineBox require jQuery.easing plugin. \nDownload it @url http://plugins.jquery.com/project/Easing');
                delete userOptions.easingOut;
            }

            // Mergin user options
            if (userOptions) {
                $.extend(options, userOptions);
            }

            fineBox.fixIELacks();
            fineBox.touchPlaceholder(options);

            // Applying hookInit
            if ((typeof options.hookInit) === 'function') {
                options.hookInit.apply(fineBox);
            }

            fineBox.$overlay.data('fineBox').$elements = [];
            this.each(function () {
                if ($(this).hasClass(options.prefix + '-processed')) {
                    fineBox.$overlay.data('fineBox').$elements.push($(this)[0]);
                }
            });

            return this.not('.' + options.prefix + '-processed').each(function () {

                var $this = $(this),
                    data = $this.data('fineBox');

                // If the plugin hasn't been initialized yet
                if (!data) {
                    
                    // save item data
                    $this.data('fineBox', {
                        '$origin' : $this,
                        'options' : options,
                        'mode' : fineBox.getOpeningMode($this)
                    }).css({
                        'display': 'block'
                    });

                    fineBox.initInfosSrc($this);
                    fineBox.$overlay.data('fineBox').$elements.push($this[0]);
                    fineBox.bindEvents(this);

                    // enrole others hyperlinks with same href
                    if ($this.attr('href') !== undefined) {
                        $(options.filter).find('a[href="' + $this.attr('href') + '"]:not(.' + options.prefix + '-processed)').not(this).off('click').on('click.fineBox', function (e) {
                            e.stopImmediatePropagation();
                            $this.trigger('click.fineBox');
                            return false;
                        }).addClass(options.prefix + '-processed');
                    }

                }
            }).addClass(options.prefix + '-processed');
        },
        
        getOpeningMode : function ($e) {
            var mode;
            if ($e.is('a[href]')) {
                if (fineBox.isImage($e.attr('href'))) {
                    mode = 'img';
                }
                else if (fineBox.isMovie($e.attr('href'))) {
                    mode = 'movie';
                }
                else {
                    mode = 'page';
                }
            }
            if ($e.is('[data-sig]')) {
                mode = 'sig';
            }
            return mode;
        }, 

        touchPlaceholder : function (options) {

            // Fine Box overlay element
            if ($('#' + options.prefix + '-overlay').length === 0) {
                fineBox.$overlay = $('<div />', {'id': options.prefix + '-overlay'}).css({
                    'z-index': 11002,
                    'position': (fineBox.isIE6 ? 'absolute' : 'fixed'),
                    'left': 0,
                    // 'top': (fineBox.isIE6 ? (document.documentElement.scrollTop + document.body.scrollTop) : 0),
                    'top': (fineBox.isIE6 ? $(window).scrollTop() : 0),
                    'width': '100%',
                    'height': '100%'
                    // ,'overflow': 'hidden'
                }).hide().appendTo('body').data('fineBox', {});
            }

            // Fine Box content wrapper element
            if ($('#' + options.prefix + '-wrapper').length === 0) {
                fineBox.$wrapper = $('<div />', {'id': options.prefix + '-wrapper'}).css({
                    'z-index': 11003,
                    'position': (fineBox.isIE6 ? 'absolute' : 'fixed'),
                    'left': 0,
                    // 'top': (fineBox.isIE6 ? (document.documentElement.scrollTop + document.body.scrollTop) : 0),
                    'top': (fineBox.isIE6 ? $(window).scrollTop() : 0),
                    'width': '100%',
                    'height': '100%',
                    // 'background-color': 'transparent',
                    'display': 'none'
                    // ,'overflow': 'hidden'
                }).appendTo('body');
            }

            // Fine Box content container element
            if ($('#' + options.prefix + '-container').length === 0) {
                fineBox.$container = $('<div />', {'id': options.prefix + '-container'}).css({
                    'position': 'absolute',
                    'left': 0,
                    'top': 0
                }).appendTo('#' + options.prefix + '-wrapper');
            }

            // Events binding for these elements
            fineBox.bindPlaceholderEvents(options);

        },
        
        addCloseButton : function () {
            // ;;; log('Firing addCloseButton !', this, arguments);

            if (!fineBox.$container.find('.close').length) {
                $('<a class="close" href="#"><i class="lemonicon-close">&times;</i></a>').css({
                    'position': 'absolute',
                    'top': '10px',
                    'right': '10px',
                    'z-index': 78
                }).one('click.fineBox', function () {
                    fineBox.$overlay.trigger('click.fineBox');
                    if (fineBox.isOpened && !fineBox.isLoading) {
                        $(this).remove();
                    }
                    return false;
                }).appendTo(fineBox.$container);
            }
            
            return this;
        },

        bindPlaceholderEvents : function (options) {

            // Enable close by clicking on overlay or wrapper
            fineBox.$overlay.add(fineBox.$wrapper).not('.' + options.prefix + '-processed').bind('click.fineBox', function () {
                if (!fineBox.isLoaded) {
                    return false;
                }
                fineBox.closeItem();
                return false;
            }).addClass(options.prefix + '-processed');
            fineBox.$container.bind('click.fineBox', function (e) {
                e.stopPropagation();
            }).css('cursor', 'default');

            $(document).bind('keydown.fineBox', function (event) {
                // Enable close with esc
                if (event.keyCode === 27) {
                    if (!fineBox.isLoaded) {
                        return false;
                    }
                    fineBox.closeItem();
                    return false;
                }
            });

            // Add onResize listener
            $(window).resize(function () {
                if (fineBox.isOpened && fineBox.isLoaded) {
                    fineBox.adjust();
                }
            });
        },

        bindEvents : function (elements) {
            $(elements).off('click').on({
                'click.fineBox': function () {
                    fineBox.isLoaded = false;
                    fineBox.isLoading = true;
                    fineBox.load($(this));
                    return false;
                },
                'mouseenter.fineBox': function () {
                    $(this).addClass('hover');
                    return false;
                },
                'mouseleave.fineBox': function () {
                    $(this).removeClass('hover');
                    return false;
                }
            });
        },

        setOriginData : function () {

            // Metrics of the DOM origin
            var options = fineBox.$current.data('fineBox').options,
                $tmp = fineBox.getBiggestInFragment(fineBox.$current),
                startW = $tmp.width(),
                startH = $tmp.height(),
                scrollX = $('body').scrollLeft() > 0 ? $('body').scrollLeft() : $(window).scrollLeft(),
                scrollY = $('body').scrollTop() > 0 ? $('body').scrollTop() : $(window).scrollTop(),
                startX = Math.round($tmp.offset().left - scrollX),
                startY = Math.round($tmp.offset().top - scrollY),

                // Get next and previous DOM elements
                all = fineBox.$overlay.data('fineBox').$elements,
                index = all.indexOf(fineBox.$current[0]),
                $previous = options.loop && all.length > 1 ? $(all[index - 1] || all[all.length - 1]) : $(all[index - 1]),
                $next = options.loop && all.length > 1 ? $(all[index + 1] || all[0]) : $(all[index + 1]),

                // Fill data
                data = {
                    'CSSorigin': {
                        'width': startW,
                        'height': startH,
                        'top': startY,
                        'left': startX
                    },
                    'scrollX': scrollX,
                    'scrollY': scrollY,
                    '$previous': ($previous !== fineBox.$current ? $previous : null) ,
                    '$next': ($next !== fineBox.$current ? $next : null)
                };

            // Save data
            $.extend(fineBox.$overlay.data('fineBox'), data);
        },

        setOverlayData : function () {

            // Metrics of the DOM box content
            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                newData,
                $target,
                hookAlterOverlayDataResult,
                endWbase,
                endHbase,
                docW = $(window).width(),
                docH = $(window).height(),
                endW,
                endH,
                endX,
                endY,
                targetW,
                targetH;

            switch (originData.mode) {
                case 'img':
                    $target = $('<img />').attr('src', originData.$target.attr('src')).addClass(options.prefix + '-target');
                    endWbase = $target[0].width;
                    endHbase = $target[0].height;
                    break;
                // case 'movie':
                //     $target = originData.$target.clone().addClass(data.options.prefix + '-target');
                //     endWbase = $target.width();
                //     endHbase = $target.height();
                //     break;
                case 'sig':
                    $target = originData.$target.clone().addClass(options.prefix + '-target');
                    endWbase = $target.width();
                    endHbase = $target.height();
                    break;
                case 'page':
                    $target = $('<img />').attr('src', originData.$target.attr('src')).addClass(options.prefix + '-target');
                    endWbase = $target[0].width;
                    endHbase = $target[0].height;
                    break;
                default:
                    $target = originData.$target.clone().addClass(options.prefix + '-target');
                    endWbase = $target.width();
                    endHbase = $target.height();
            }

            // // Use an image copy
            // $target = $('<img />').attr('src', $targetBase.attr('src')).addClass(data.options.prefix + '-target');
            // log('TARGET', $target, $target.width(), $target.height(), $target[0].width, $target[0].height);

            // Fill real image dimensions
            // endWbase = $target[0].width;
            // endHbase = $target[0].height;
            // endWbase = $target.width();
            // endHbase = $target.height();

            // Default end width and end height
            endW = endWbase;
            endH = endHbase;

            // Set end width
            if (endWbase >= (docW - options.viewportSpace - 1)) {
                endW = Math.round(docW - options.viewportSpace);
                endH = Math.round((endHbase  / endWbase) * endW);
            }

            // Set end height
            if (endH >= (docH - options.viewportSpace - 1)) {
                endH = Math.round(docH - options.viewportSpace);
                endW = Math.round((endWbase / endHbase) * endH);
            }

            // Set end image dimensions
            targetW = endW;
            targetH = endH;

            // Set end position
            endX = Math.round((docW - endW) / 2);
            endY = Math.round((docH - endH) / 2);

            // Fill data
            newData = {
                'CSSoverlay': {
                    'width': endW,
                    'height': endH,
                    'top': endY,
                    'left': endX
                    // ,'overflow': 'visible'
                },
                'CSStarget': {
                    'width': targetW,
                    'height': targetH
                    // ,'overflow': 'visible'
                }
                // , '$target': $target
            };

            // Save data
            $.extend(fineBox.$overlay.data('fineBox'), newData);

            // Apply user hook
            if (typeof options.hookAlterOverlayData === 'function') {
                hookAlterOverlayDataResult = options.hookAlterOverlayData.apply(fineBox, [fineBox.$overlay.data('fineBox')]);
                if (hookAlterOverlayDataResult) {
                    // Save data
                    $.extend(fineBox.$overlay.data('fineBox'), hookAlterOverlayDataResult);
                }
            }

        },

        adjust : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options;

            if (fineBox.isLoading) {
                return false;
            }

            fineBox.setOverlayData();
            fineBox.unfreezeWindowScroll();

            originData.$target.stop(true).animate(
                data.CSStarget,
                options.durationIn,
                options.easingIn
            );

            fineBox.$container.stop(true).animate(
                data.CSSoverlay,
                options.durationIn,
                options.easingIn,
                function () {
                    fineBox.$container.css('overflow', 'inherit');
                    fineBox.freezeWindowScroll();
                    fineBox.setOriginData();
                    if (typeof options.hookAdjust === 'function') {
                        options.hookAdjust.apply(fineBox, [fineBox.$overlay.data('fineBox')]);
                    }
                }
            );

        },

        load : function ($this) {

            var options = $this.data('fineBox').options,
                $parent = $this.parent(),
                $infos = $this.data('fineBox').$infos,
                $target,
                img,
                $img,
                $msgTarget = !fineBox.isOpened ? $parent : fineBox.$container,
                indicator = new Indicator($msgTarget);

            fineBox.$current = $this;
            $.extend(fineBox.$overlay.data('fineBox'), {
                '$current' : $this
            });
            fineBox.isLoading = true;
            indicator.add({
                'display': 'block',
                'position': 'absolute',
                'top': 0,
                'left': 0,
                'width': !fineBox.isOpened ? $this.width() : fineBox.$overlay.data('fineBox').CSStarget.width,
                'height': !fineBox.isOpened ? $this.height() : fineBox.$overlay.data('fineBox').CSStarget.height,
                'background-position': 'center center'
            });
            $this.fadeTo('fast', 0.5);

            function removeIndicator(callback) {
                var args = arguments;
                fineBox.isLoading = false;
                $this.fadeTo('fast', 1, function () {
                    indicator.remove();
                    if (callback) {
                        fineBox.hook.apply(fineBox, args);
                    }
                });
            }

            function loadNextIfIsOpened() {
                if (fineBox.isOpened) {
                    setTimeout(function () {
                        fineBox.setMessage(options.strings.loadNext, 'normal', $msgTarget);
                        setTimeout(function () {
                            fineBox.publics.next();
                        }, options.messageDelay);
                    }, (options.messageDelay * 1.2));
                }
            }

            function onErrorAction(msg) {
                msg = msg && typeof (msg) === 'string' ? msg : options.strings.loadError;
                removeIndicator('setMessage', msg, 'error', $msgTarget);
                // loadNextIfIsOpened();
                fineBox.isLoaded = true;
            }
            
            switch ($this.data('fineBox').mode) {

                case 'img':

                    $(img = new Image())
                        .error(onErrorAction)
                        .load(function () {
                            img.onload = null;
                            removeIndicator();
                            setTimeout(function () {
                                $.extend($this.data('fineBox'), {
                                    '$target' : $(img),
                                    '$infos' : $infos
                                });
                                fineBox.openItem($this);
                            }, 1);
                        }).addClass(options.prefix + '-target');

                    setTimeout(function () {
                        img.src = $this.attr('href');
                    }, 1);
                
                    break;

                case 'movie':

                    onErrorAction('Not yet implemented!');
                    break;
                
                case 'page':

                    $.ajax({
                        type: 'GET',
                        url: $this.attr('href'),
                        cache: true,
                        dataType: 'html',
                        async: true,
                        success: function (data) {
                            var $html = $(data).find(options.filter).attr('id', null);
                            if (!$infos || !$infos.length) {
                                $infos = $html.find(options.infosSelector).attr('id', null);
                            }
                            $(img = new Image())
                                .error(onErrorAction)
                                .load(function () {
                                    img.onload = null; //stops animated gifs from firing the onload repeatedly.
                                    removeIndicator();
                                    setTimeout(function () {

                                        $.extend($this.data('fineBox'), {
                                            '$target' : $(img),
                                            '$infos' : $infos
                                        });
                                        fineBox.openItem($this);
                                    }, 1);
                                }).addClass(options.prefix + '-target').get(0);

                            setTimeout(function () {
                                $img = fineBox.getBiggestInFragment($html).detach();
                                img.src = $img.attr('src');
                            }, 1);
                        },
                        error: onErrorAction
                    });

                    break;

                case 'sig':
                    
                    var configKey = '114405126768',
                        playerKey = '2dc869296ecb',
                        sig = $this.data('sig');

                    if (!sig) {
                        onErrorAction();
                        break;
                    }

                    if (typeof $this.data('fineBox').$target != 'undefined') {
                        $target = $this.data('fineBox').$target;
                    }
                    else {
                        $target = $('<div id="flash_kplayer_' + sig + '" class="flash_kplayer" data-sig="' + sig + '" data-playerkey="' + playerKey + '" style="width: 640px; height: 360px; margin: 0; padding: 0;">'
                            +'<object type="application/x-shockwave-flash" data="http://sa.kewego.com/swf/kp.swf" name="kplayer_' + sig + '" id="kplayer_' + sig + '" height="100%" width="100%">'
                            +'<param name="bgcolor" value="0x000000">'
                            +'<param name="allowfullscreen" value="true">'
                            +'<param name="allowscriptaccess" value="always">'
                            +'<param name="flashVars" value="language_code=en&amp;playerKey=' + playerKey + '&amp;configKey=' + configKey + '&amp;suffix=&amp;sig=' + sig + '&amp;autostart=true">'
                            +'<param name="movie" value="http://sa.kewego.com/swf/kp.swf">'
                            +'<param name="wmode" value="opaque">'
                            +'<param name="SeamlessTabbing" value="false">'
                            +'<video poster="http://api.kewego.com/video/getHTML5Thumbnail/?playerKey=' + playerKey + '&amp;sig=' + sig + '" preload="none" controls="controls" height="100%" width="100%"></video>'
                            +'</object>'
                            +'</div>').addClass(options.prefix + '-target');
                    }
                    $.extend($this.data('fineBox'), {
                        '$target' : $target,
                        '$infos' : $infos
                    });

                    removeIndicator();
                    setTimeout(function () {
                        fineBox.openItem($this);
                    }, 1);

                    break;
            }
        },

        openItem : function ($this) {

            fineBox.isOpening = true;
            fineBox.setOriginData();
            fineBox.setOverlayData();
            fineBox.freezeWindowScroll();

            switch ($this.data('fineBox').options.transitionMode) {
                case 'full':
                    fineBox.closeItem('fireOpening');
                    break;
                case 'minimal':
                    fineBox.fireOpening();
                    break;
            }

        },

        closeItem : function (callback) {

            var data = fineBox.$overlay.data('fineBox'),
                options = fineBox.$current.data('fineBox').options,
                CSSorigin = data.CSSorigin,
                args = arguments;

            if (!fineBox.isLoaded) {
                if (callback) {
                    fineBox.hook.apply(fineBox, args);
                }
                return false;
            }

            fineBox.enableSlideShow = false;
            fineBox.hidePager();
            fineBox.hideInfos();

            if (fineBox.isOpened) {
                fineBox.$overlay.fadeOut('fast', function () {
                    fineBox.isOpened = false;
                    fineBox.getBiggestInFragment(fineBox.$container).stop(true).animate(
                        {
                            'width': CSSorigin.width,
                            'height': CSSorigin.height
                        },
                        options.durationOut,
                        options.easingOut
                    );
                    fineBox.$container.removeClass('opened').stop(true).animate(
                        CSSorigin,
                        options.durationOut,
                        options.easingOut,
                        function () {
                            $(this).fadeOut('fast', function () {
                                fineBox.$container.empty();
                                fineBox.$wrapper.css('display', 'none');
                                fineBox.unfreezeWindowScroll();
                                fineBox.setOriginData();
                                if (callback) {
                                    fineBox.hook.apply(fineBox, args);
                                }
                            });
                        }
                    );
                });
            } else {
                if (callback) {
                    fineBox.hook.apply(fineBox, args);
                }
            }
        },

        fireOpening : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $target = originData.$target,
                CSSorigin = data.CSSorigin,
                CSSoverlay = data.CSSoverlay,
                CSStarget = data.CSStarget,
                $msgTarget = !fineBox.isOpened ? fineBox.$current.parent() : fineBox.$container;

            if (!fineBox.isOpened) {
                $target.css(CSSorigin).detach().appendTo(fineBox.$container).show();
                fineBox.$wrapper.css('display', 'block');
                fineBox.$container.css(CSSorigin).fadeIn('fast', function () {
                    if (options.transitionMode === 'full') {
                        fineBox.freezeWindowScroll();
                    }
                    $target.stop(true).animate(
                        CSStarget,
                        options.durationIn,
                        options.easingIn
                    );
                    $(this).stop(true).animate(
                        CSSoverlay,
                        options.durationIn,
                        options.easingIn,
                        function () {
                            $(this).addClass('opened').css('overflow', 'inherit').addClass(options.prefix + '-' + originData.mode);
                            fineBox.isOpening = false;
                            fineBox.isOpened = true;
                            // if ((typeof options.hookOnOpen) === 'function') {
                            //     options.hookOnOpen.apply(fineBox);
                            // } else {
                            //     fineBox.showInfos();
                            // }
                            fineBox.addCloseButton();
                            fineBox.showInfos();
                            fineBox.showPager();
                            fineBox.$overlay.fadeTo('slow', options.overlayOpacity, function () {
                                fineBox.isLoaded = true;
                                if (fineBox.enableSlideShow) {
                                    setTimeout(function () {
                                        fineBox.setMessage(options.strings.loadNext, 'normal', $msgTarget);
                                        setTimeout(function () {
                                            fineBox.publics.next();
                                        }, options.messageDelay);
                                    }, (options.interval));
                                }
                            });
                        }
                    );

                });
            } else {
                // log('fireOpening B', options.durationIn, fineBox.hideInfos().stop(true).delay(options.durationIn).find('.' + options.prefix + '-target').hide());
                fineBox.hidePager();
                $target.css(CSStarget);
                // fineBox.hideInfos().stop(true).delay(options.durationIn).find('.' + options.prefix + '-target').fadeOut((options.durationIn / 1.2), function () {
                fineBox.hideInfos().$container.stop(true).delay(options.durationIn).find('.' + options.prefix + '-target').fadeOut((options.durationIn / 1.2), function () {
                    $(this).remove();
                }).end().delay((options.durationIn / 1.2)).animate(
                    CSSoverlay,
                    options.durationIn,
                    options.easingIn,
                    function () {
                        var regex = new RegExp(options.prefix + '-.+', 'gi');
                        fineBox.$container[0].className = fineBox.$container[0].className.replace(regex, '');
                        fineBox.$container.css('overflow', 'inherit').addClass(options.prefix + '-' + originData.mode);
                        $target.hide().appendTo(fineBox.$container).fadeIn('fast', function () {
                            fineBox.isOpening = false;
                            fineBox.isOpened = true;
                            // if ((typeof options.hookOnOpen) === 'function') {
                            //     options.hookOnOpen.apply(fineBox);
                            // } else {
                            //     
                            // }
                            fineBox.addCloseButton();
                            fineBox.showInfos();
                            fineBox.showPager();
                            fineBox.isLoaded = true;
                            if (fineBox.enableSlideShow) {
                                setTimeout(function () {
                                    fineBox.setMessage(options.strings.loadNext, 'normal', $msgTarget);
                                    setTimeout(function () {
                                        fineBox.publics.next();
                                    }, options.messageDelay);
                                }, (options.interval));
                            }
                        });
                    }
                );
            }
        },

        initInfosSrc : function ($e) {
            var data = $e.data(),
                $infos;
            if (data.infosSrc) {
                $infos = $(data.infosSrc);
                if (!$infos.length) {
                    $.ajax({
                        url: data.infosSrc
                    }).done(function (html) {
                        $.extend($e.data('fineBox'), {
                            '$infos' : $(html).attr('id', null)
                        });
                    });
                } else {
                    $.extend($e.data('fineBox'), {
                        '$infos' : $infos.clone().attr('id', null)
                    });
                }
            }
            return this;
        },
        
        showInfos : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $infos = originData.$infos;
            
            if ((typeof options.hookOnOpen) === 'function') {
                options.hookOnOpen.apply(fineBox);
            } else {
                if ($infos && $infos.length) {
                    if ($infos.not('.' + options.prefix + '-infos')) {
                        $infos = $infos.show().wrap('<div class="' + options.prefix + '-infos" />').parent();
                    }
                    $infos.hide().css({
                        'position': 'absolute',
                        'top' : 0,
                        'right' : '3em',
                        'width': '33%',
                        'height': 'auto'
                    }).appendTo(fineBox.$container).fadeIn();
                }
            }

            return this;

        },

        hideInfos : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $infos = fineBox.$container.find('.' + options.prefix + '-infos'),
                callbacks = $.Callbacks('once');

            callbacks.add(function () {
                $infos.remove();
            });

            if ((typeof options.hookOnClose) === 'function') {
                options.hookOnClose.apply(fineBox);
            } else {
                $infos.fadeOut('fast', function () {
                    callbacks.fire();
                });
            }

            return this;

        },

        showPager : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $prevDiv,
                $nextDiv,
                prevHref,
                nextHref,
                bottom = originData.mode === 'sig' ? '40%' : 0,
                $pager = fineBox.$container.find('.pager'),
                tpl = '<ul class="pager"><li class="previous ' + options.prefix + '-previous" style="display: none;"><a href="#"></a></li><li class="next ' + options.prefix + '-next" style="display: none;"><a href="#"></a></li></ul>';

            if (typeof options.hookPager === 'function') {
                options.hookPager.apply(fineBox, [options.prefix + '-previous', options.prefix + '-next']);
            }
            
            if ($pager.length === 0) {
                $pager = $(tpl).prependTo(fineBox.$container).css({
                    position: 'absolute',
                    left: -10,
                    right: -10,
                    bottom: bottom,
                    zIndex: 76
                });
            }
            else {
                $pager.css('bottom', bottom);   
            }

            $prevDiv = $pager.find('.' + options.prefix + '-previous');
            $nextDiv = $pager.find('.' + options.prefix + '-next');
            
            prevHref = data.$previous.attr('href') || '';
            nextHref = data.$next.attr('href') || '';
            
            if ($prevDiv && $prevDiv.find('a').length > 0 && data.$previous.length > 0 && data.$previous !== fineBox.$current) {
                $prevDiv.find('a').attr('href', prevHref).html('<i class="icon-chevron-left"></i><span>' + options.strings.prev + '</span>').off('click').on('click.fineBox', function () {
                    fineBox.publics.previous();
                    return false;
                }).end().fadeIn();
            }
            if ($nextDiv && $nextDiv.find('a').length > 0 && data.$next.length > 0 && data.$next !== fineBox.$current) {
                $nextDiv.find('a').attr('href', nextHref).html('<span>' + options.strings.next + '</span><i class="icon-chevron-right"></i>').off('click').on('click.fineBox', function () {
                    fineBox.publics.next();
                    return false;
                }).end().fadeIn();
            }
        },

        hidePager : function () {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $prevDiv = fineBox.$container.find('.' + options.prefix + '-previous'),
                $nextDiv = fineBox.$container.find('.' + options.prefix + '-next');

            $prevDiv.add($nextDiv).fadeOut().find('a').attr('href', '').html('').off('click.fineBox');
        },

        scrollToIfNotInView : function ($element, callback) {

            var data = fineBox.$overlay.data('fineBox'),
                originData = fineBox.$current.data('fineBox'),
                options = originData.options,
                $scrollable = fineBox.$current.closest(':scrollable');
            
            if ($element.length) {

                // log('options.viewportSpace', options.viewportSpace);
                // log('$element', $element, 'offsetTop: ' + parseInt($element.offset().top, 10), 'positionTop: ' + parseInt($element.position().top, 10), 'scrollTop: ' + parseInt($element.scrollTop(), 10), 'css.top: ' + $element.css('top'));
                // log('$scrollable', $scrollable, 'offsetTop: ' + parseInt($scrollable.offset().top, 10), 'positionTop: ' + parseInt($scrollable.position().top, 10), 'scrollTop: ' + parseInt($scrollable.scrollTop(), 10));
                // log('RESULT', $element.position().top - options.viewportSpace);
                // log('--------------------------------------')

                $scrollable.stop(true).animate(
                    {
                        'scrollTop': ($element.position().top - options.viewportSpace)
                    },
                    {
                        duration : options.durationIn,
                        easing : options.easingIn,
                        complete : function () {
                            if (callback) {
                                callback.apply(fineBox);
                            }
                        }
                    }
                );
            } else {
                if (callback) {
                    callback.apply(fineBox);
                }
            }
        },

        publics : {
            getOptions : function () {
                return fineBox.$current.data('fineBox').options;
            },
            open : function (options) {
                if (!this.data('fineBox')) {
                    this.fineBox(options);
                }
                fineBox.load(this);
                return this;
            },
            close : function (options) {
                // if (!this.data('fineBox')) {
                //     this.fineBox(options);
                // }
                // fineBox.load(this);
                // return this;
            },
            previous : function () {
                if (fineBox.$overlay.data('fineBox').$previous !== fineBox.$current) {
                    fineBox.scrollToIfNotInView(fineBox.$overlay.data('fineBox').$previous, function () {
                        this.$overlay.data('fineBox').$previous.trigger('click.fineBox');
                    });
                }
            },
            next : function () {
                if (fineBox.$overlay.data('fineBox').$next !== fineBox.$current) {
                    fineBox.scrollToIfNotInView(fineBox.$overlay.data('fineBox').$next, function () {
                        this.$overlay.data('fineBox').$next.trigger('click.fineBox');
                    });
                }
            },
            destroy : function () {
                // var elements;
                // if (this) {
                //     elements = this;
                // } else {
                //     elements = fineBox.$overlay.data('fineBox').$elements;
                // }
                // return elements.each(function () {
                //     var $this = $(this),
                //         data = $this.data('fineBox');
                // 
                //     $(window).unbind('.fineBox');
                //     data.fineBox.remove();
                //     $this.removeData('fineBox');
                //     fineBox.remove();
                // });
            }
        }
    };

    $.fn.fineBox = function (method) {
        if (fineBox.publics[method]) {
            return fineBox.publics[method].apply(this, Array.prototype.slice.call(arguments, 1));
        } else if (typeof method === 'object' || !method) {
            return fineBox.init.apply(this, arguments);
        } else {
            $.error('Method ' +  method + ' does not exist on jQuery.fineBox');
        }
    };

})(jQuery);
