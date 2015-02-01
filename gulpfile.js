var vinyl_source = require('vinyl-source-stream');
var browserify = require('browserify');
var watchify = require('watchify');
var gulp = require('gulp');
var gulp_util = require('gulp-util');

var generateBrowserifyBundler = function(){
	var bundler = browserify( './src/scripts/content.js', watchify.args );
	bundler.transform('hbsfy');
	bundler.transform('lessify');
	return bundler;
};

gulp.task( 'compile content.js', function(){
	var bundler = generateBrowserifyBundler();
	return bundler.bundle()
		.pipe( vinyl_source('content.js') )
		.pipe( gulp.dest('./dist/scripts') );
});

gulp.task( 'compile and watch content.js', function(){
	var bundler = watchify( generateBrowserifyBundler() );
	var bundle = function(){
		return bundler.bundle()
			.on( 'error', function( error ){
				gulp_util.log( '[watchify]', error.toString() );
				gulp_util.beep();
				this.emit('end');
			})
			.pipe( vinyl_source('content.js') )
			.pipe( gulp.dest('./dist/scripts') );
	};
	bundler.on( 'update', function(){
		gulp_util.log( '[watchify]', 'Bundling content.js...');
		bundle();
	});
	bundler.on( 'time', function( time ){
		gulp_util.log( '[watchify]', 'Bundled content.js in '+ time +'ms');
	});
	return bundle();
});

gulp.task( 'copy static files', function(){
	gulp.src([
		'./src/manifest.json',
		'./src/popup.html',
		'./src/scripts/vendor/**/*'
	], { base: './src' })
		.pipe( gulp.dest('dist') );
});

gulp.task( 'watch static files', function(){
	gulp.watch([
		'./src/manifest.json',
		'./src/popup.html',
		'./src/scripts/vendor/**/*'
	], ['copy static files']);
});

gulp.task( 'build', [
	'compile content.js',
	'copy static files'
]);

gulp.task( 'dev', [
	'compile and watch content.js',
	'copy static files',
	'watch static files'
]);

gulp.task( 'default', ['dev'] );