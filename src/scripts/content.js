// automatically inject CSS
require('../styles/content.less');

// third party modules
var gifjs = require('gif.js');
var $ = window.jQuery = window.$ = require('jquery');
var velocity = require('velocity-animate');
require('velocity-animate/velocity.ui.js');
var getFormData = require('./vendor/getFormData.js');
var toSeconds = require('./vendor/toSeconds.js');
var asyncSeek = require('./utils/asyncSeek.js');

// templates
var gifit_button_template = require('../templates/button.hbs');
var gifit_options_template = require('../templates/options.hbs');
var _gifit_progress_template = require('../templates/progress.hbs');

var Handlebars = require('hbsfy/runtime');
Handlebars.registerPartial( 'progress', _gifit_progress_template );

const MAXIMUM_Z_INDEX = 2147483647;
const EN_GATHERING_FRAMES = 'Gathering frames…';
const EN_RENDERING_GIF = 'Rendering GIF…';

var gifit_defaults = {
	width: 320,
	framerate: 10,
	quality: 5
};

// get DOM selections sorted
var $window = $(window);
var $body = $('body');
var $youtube_player_api = $('#player-api');
var $youtube_video_container = $youtube_player_api.find('.html5-video-container');
var $youtube_video = $youtube_player_api.find('video.video-stream');
var youtube_video = $youtube_video.get(0);
var $youtube_controls = $youtube_player_api.find('.html5-video-controls');
var $youtube_controls_chrome = $youtube_controls.find('.html5-player-chrome');
var $gifit_button = $( gifit_button_template() );
$youtube_controls_chrome.append( $gifit_button );

var $gifit_canvas = $('<canvas id="gifit-canvas"></canvas>');
var gifit_canvas_context = $gifit_canvas.get(0).getContext('2d');
$body.append( $gifit_canvas );


var $gifit_options = $( gifit_options_template() );
var $gifit_options_form = $gifit_options.children('form');
var $gifit_options_form_height = $gifit_options_form.find('#gifit-option-height');
$youtube_controls.append( $gifit_options );

var $gifit_progress = $gifit_options.find('.gifit-progress');
var $gifit_progress_information = $gifit_progress.find('.gifit-progress-information');
var $gifit_progress_container = $gifit_progress.find('.gifit-progress-container');
var $gifit_progress_progress = $gifit_progress.find('progress');
var $gifit_progress_image = $gifit_progress.find('img');
var $gifit_progress_close = $gifit_progress.find('.gifit-progress-close');

var gif;
var capture_interval;
var initialized;

$.Velocity.RegisterEffect('gifit.slideUpIn', {
	defaultDuration: 900,
	calls: [ 
		[{
			scaleX: [ 1, 0.8 ],
			translateY: [ 0, 350 ],
			translateZ: 0
		}, 1, {
			easing: [0.165, 0.84, 0.44, 1]
		}]
	]
});

$.Velocity.RegisterEffect('gifit.slideDownOut', {
	defaultDuration: 500,
	calls: [ 
		[{
			scaleX: [ 0.8, 1 ],
			translateY: 350,
			translateZ: 0
		}, 1, {
			easing: [0.895, 0.03, 0.685, 0.22]
		}]
	],
	reset: { translateY: 0 }
});

var initializeWidget = function(){
	if( initialized ) return;
	initialized = true;
	var gifit_default_height = Math.ceil( ( $youtube_video.height() / $youtube_video.width() ) * gifit_defaults.width );
	$gifit_options_form_height.val( gifit_default_height );
};

var generateGIF = function( options ){
	progressState();
	// tell the user what we're doing
	$gifit_progress_information.text( EN_GATHERING_FRAMES ).show();
	var frame_gathering_progress = 0;
	// generate GIF options
	options = $.extend( gifit_defaults, options );
	options.frame_interval = 1000 / options.framerate;
	options.start = toSeconds( options.start );
	options.end = toSeconds( options.end );
	if( options.end > youtube_video.duration ) options.end = youtube_video.duration;
	// try to avoid playlist advancement
	if( options.end === youtube_video.duration ) options.end = youtube_video.duration - 0.1;
	options.quality = ( 31 - ( options.quality * 3 ) );
	var gif_duration = options.end - options.start;
	// create GIF encoder
	gif = new gifjs.GIF({
		workers: 8,
		quality: options.quality,
		repeat: 0,
		width: options.width,
		height: options.height,
		workerScript: chrome.runtime.getURL('scripts/vendor/gif.worker.js')
	});
	gif.on( 'finished', function( blob ){
		$gifit_progress_information.text(' ').hide( 250 );
		$gifit_progress_image.attr( 'src', URL.createObjectURL( blob ) );
		// you have to wait for the image to load in order to measure it
		// even though it's just a blob image
		$gifit_progress_image.on('load', function(){
			$gifit_progress_progress.attr( 'value', 0 );
			displayState();
		});
	});
	gif.on( 'progress', function( progress_ratio ){
		setProgress( frame_gathering_progress, progress_ratio );
	});
	// prepare canvas for receiving frames
	$gifit_canvas
		.attr( 'width', options.width )
		.attr( 'height', options.height );
	// make sure the video is paused before we jump frames
	if( !youtube_video.paused ){
		youtube_video.pause();
	}
	asyncSeek( youtube_video, options.start, function(){
		var addFrame = function(){
			var current_time = youtube_video.currentTime;
			if( current_time >= options.end ){
				// render the GIF
				gif.render();
				// tell the user what we're doing
				// TODO move this somewhere more sane
				$gifit_progress_information.text( EN_RENDERING_GIF );
				return;
			}
			gifit_canvas_context.drawImage( youtube_video, 0, 0, options.width, options.height );
			gif.addFrame( $gifit_canvas.get(0), {
				delay: options.frame_interval,
				copy: true
			});
			frame_gathering_progress = ( current_time - options.start ) / gif_duration;
			setProgress( frame_gathering_progress, 0 );
			var next_frame_time = current_time + ( 1 / options.framerate );
			asyncSeek( youtube_video, next_frame_time, addFrame );
		};
		addFrame();
	});
};

var progressState = function(){
	$gifit_options_form.find('input, button').prop( 'disabled', true );
	$gifit_options.addClass('gifit-processing');
};

var setProgress = function( frame_gathering_progress, frame_rendering_progress ){
	frame_gathering_progress = frame_gathering_progress || 0;
	frame_rendering_progress = frame_rendering_progress || 0;
	var overall_progress = ( frame_gathering_progress * 0.7 ) + ( frame_rendering_progress * 0.3 );
	$gifit_progress_progress.attr( 'value', overall_progress );
};

var displayState = function(){
	var image_height = $gifit_progress_image.height();
	$gifit_progress.addClass('gifit-loaded');
	$gifit_progress_container.css('height', image_height);
	$gifit_options_form.find('input, button').prop( 'disabled', false );
	$gifit_options.removeClass('gifit-processing');
	$gifit_options.addClass('gifit-displaying');
};

var normalState = function(){
	$gifit_options.removeClass('gifit-displaying');
	$gifit_progress.removeClass('gifit-loaded');
	$gifit_progress_image.attr('src', '');
	$gifit_progress_container.css('height', '');
};

$gifit_button.on( 'click', function( e ){
	initializeWidget();
	$body.toggleClass('gifit-active');
	if( $gifit_options.is(':visible') ){
		$gifit_options.velocity( 'gifit.slideDownOut', 250, {
			complete: function(){
				$gifit_options.find('fieldset, .gifit-actions').velocity({
					opacity: 0
				}, 0 );
			}
		});
	}
	else {
		$gifit_options.velocity( 'gifit.slideUpIn', 250 );
		$gifit_options.find('fieldset, .gifit-actions').velocity( 'transition.slideUpIn', { stagger: 35 }, 55 );
	}
});

$gifit_options_form.on( 'submit', function( e ){
	e.preventDefault();
	var options = getFormData( $gifit_options_form.get(0) );
	generateGIF( options );
});

$gifit_options.on( 'keydown keypress click contextmenu', function( e ){
	e.stopImmediatePropagation();
});

$gifit_progress_close.on( 'click', function( e ){
	e.preventDefault();
	normalState();
});
