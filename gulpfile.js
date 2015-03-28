'use strict';
var gulp    = require('gulp')
  , rimraf  = require('rimraf')
  , plumber = require('gulp-plumber')
  , babel   = require('./package.json').babel
  , configs = require('./webpack.configs')
  , babelTransform = require('gulp-babel-helpers')
  , webpack = require('webpack')
  , prompt  = require('prompt')
  , fs      = require('fs')
  , spawn   = require('child_process').spawn
  , WebpackDevServer = require("webpack-dev-server");


gulp.task('clean', function(cb){
  rimraf('./lib', cb);
})



gulp.task('transpile', ['clean'], function(){

  return gulp.src(['./src/**/*.jsx', './src/**/*.js'])
      .pipe(plumber())
      .pipe(babelTransform(
          babel
        , './util/babelHelpers.js'
        , './lib/util/babelHelpers.js'))
      .pipe(gulp.dest('./lib'));
})

gulp.task('dev', function() {

  new WebpackDevServer(webpack(configs.dev), {
    publicPath: "/dev",
    hot: true,
    stats: { colors: true }
  })
  .listen(8080, 'localhost', function (err, result) {
    if (err) 
      return console.log(err);
    
    console.log('Listening at localhost:8080');
  });

})

gulp.task('release', ['clean', 'transpile'])

gulp.task('publish', function(cb){
  var schema = {
    properties: {
      version: {
        description: 'version? (old is '+ require('./package.json').version +')',
        pattern: /^[0-9]\.[0-9]+\.[0-9](-.+)?/,
        message: 'Must be a valid semver string i.e. 1.0.2, 2.3.0-beta.1',
        required: true
      }
    }
  };

  prompt.start();

  prompt.get(schema, function(err, result) {
    if (err) throw err;

    var rawVersion = result.version
      , version = 'v' + rawVersion
      , npm   = require('./package.json')
      , bower = require('./bower.json')
      , oldVersion = npm.version;

    updateVersion(rawVersion)

    run('git co master && gulp release', function(){
      run('npm test', function() {
        run('git cm "release '+ version +'"', function () {
          run('git tag -am ' + rawVersion + ' ' + version, function() {
            run('git push origin master --follow-tags ', function(){
              run('npm publish', cb);
            })
          })
        })
      })
    })

    function updateVersion(ver){
      bower.version = npm.version = ver
      fs.writeFileSync('./package.json', JSON.stringify(npm, null, 2));
      fs.writeFileSync('./bower.json', JSON.stringify(bower, null, 2));
    }

    function run(command, callback) {
      console.log('spawn: ' + command);
      sp(command, function(error) {
        if (error) {
          updateVersion(oldVersion)
          throw new Error(error)
        } 
        if (callback) callback();
      });
    }
  });
})


function sp(cmd, cb){
  var child = spawn('cmd.exe', ['/s', '/c', '"' + cmd + '"'], { windowsVerbatimArguments: true })
    , stderr, err, exited;

  child.stdout.on('data', function (data) {
    process.stdout.write(data.toString('utf8'))
  });

  child.stderr.on('data', function (data) {
    stderr += data.toString('utf8')
    process.stdout.write(data.toString('utf8'))
  });

  child.on('close', onExit)
  child.on('error', function (error) {
    err = error
    child.stdout.destroy();
    child.stderr.destroy();
    onExit()
  });

  function onExit(code) {
    if (exited) return;
    exited = true;
    if ( code === 0 ) cb(null)
    else if (!err) err = new Error('Command failed: ' + cmd + '\n' + stderr)
    cb(err)
  }
}
