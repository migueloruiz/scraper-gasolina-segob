const gulp = require('gulp');
const gutil = require('gulp-util');
const fs = require('fs');
const parseXlsx = require('excel');
const scrapeIt = require("scrape-it");
const async = require('async');
const jeditor = require("gulp-json-editor");
const request = require('request');

gulp.task('default', function(callback) {
  async.auto({
    scarpArticleUrl: cb => scarpArticleUrl(cb),
    scarpXlsxUrl: ['scarpArticleUrl', (results, cb) => scarpXlsxUrl (results, cb)],
    getXlsxFile: ['scarpXlsxUrl', (results, cb) => getXlsxFile (results, cb)],
    prossesFile: ['getXlsxFile', (results, cb) => prossesFile (results, cb)]
  }, (err, results) => {
    if (err) gutil.log(gutil.colors.red(err));
    gutil.log(gutil.colors.magenta('Termino'));
  })
});

function scarpArticleUrl (cb) {
  let scrapOtions = {
    articles: {
      listItem: 'article',
      data: {
        title: 'h4',
        link: {selector: 'a', attr: 'href'}
      }
    }
  }

  scrapeIt('https://www.gob.mx/aperturagasolinas', scrapOtions).then(page => {
    var filterArticles = page.articles.filter((item) =>{
      return (item.title.search('Precios máximos') != -1) ? true : false
    })

    if (filterArticles.length > 0 ) {
      gutil.log(gutil.colors.magenta('Articulo Url: '), 'https://www.gob.mx' + filterArticles[0].link);
      cb(null, 'https://www.gob.mx'+filterArticles[0].link)
    } else {
      // TODO: enviar mensaje
      cb('Article with "Precios máximos" No Found', null)
    }
  }).catch( err => {
    // TODO: enviar mensaje
    cb('Article Error: '+ err, null)
  });
}

function scarpXlsxUrl (results, cb) {
  let scrapOtions = {
    achors: {
      listItem: '.article-body > p + ul',
      data: {
        link: { selector: 'a', attr: 'href'}
      }
    }
  }

  scrapeIt(results.scarpArticleUrl, scrapOtions).then(page => {
      if (page.achors[1] != undefined) {
        gutil.log(gutil.colors.magenta('Xlsx Url: '), page.achors[1].link);
        cb(null, page.achors[1].link)
      } else {
        // TODO: enviar mensaje
        cb('Anchor with ".xlsx" No Found', null)
      }
  }).catch( err => {
    // TODO: enviar mensaje
    cb('Archor Erroe: '+ err, null)
  });
}

function getXlsxFile (results, cb) {
  gutil.log(gutil.colors.magenta('Descargarndo Xlsx...'));
  var file = fs.createWriteStream('gasolina.xlsx');

  request(results.scarpXlsxUrl).on('response',  function (response) {
    if (response.statusCode === 200) {
      response.pipe(file).on('close', function(){
        gutil.log(gutil.colors.magenta('Descarga Xlsx Terminada'));
        cb(null, null)
      });
    } else {
      console.log('Descargarndo Xlsx2')
      // TODO: enviar mensaje bot
      cb('Descarga de Xlsx Error: '+ response.statusCode, null)
    }
  });
}

function prossesFile (results, cb) {
  gutil.log(gutil.colors.magenta('Procesando Xlsx'));
  parseXlsx('gasolina.xlsx', function(err, data) {
    if(err) throw err
    var gasData = getCleanJson( data )

    // TODO: Actualizar la base de datos aqui

    fs.writeFile('gas.json',JSON.stringify(gasData) , function(err){
      if(err) gutil.log(gutil.colors.red(err));
      gutil.log(gutil.colors.magenta('Json Generado'));
      cb(null, null)
    })
  });
}

function getCleanJson( array ){
  var orderJson = { estados: {} }
  var lastState = '';
  orderJson.timestamp = getDateFrom(array[0][0])
  for (var i = 3; i < array.length; i++) {
    if ( isValidRow( array[i] ) ){
      if (lastState !== array[i][2] && array[i][2] !== ''){
        if( !orderJson.estados.hasOwnProperty(array[i][2]) ){
          orderJson.estados[array[i][2]] = {}
        }
        lastState = array[i][2]
      }
      let municipio = array[i][3];
      orderJson.estados[lastState][municipio] = {
        magna: parseFloat(array[i][4]).toFixed(2),
        premium: parseFloat(array[i][5]).toFixed(2),
        diesel: parseFloat(array[i][6]).toFixed(2)
      }
    }
  }

  // Se obtine el maximo
  // ========================
  // ========================
  // ========================
    let estadosKeys = Object.keys(orderJson.estados)
    estadosKeys.forEach((estado) => {
      let municipiosKeys = Object.keys(orderJson.estados[estado])

      var maxMagna = 0
      var maxMagnaCity = ''
      municipiosKeys.forEach((municipio) => {
        if (parseFloat(orderJson.estados[estado][municipio].magna) > maxMagna) {
          maxMagna = parseFloat(orderJson.estados[estado][municipio].magna)
          maxMagnaCity = municipio
        }
      })

      orderJson.estados[estado].maximo = {
        magna: parseFloat(orderJson.estados[estado][maxMagnaCity].magna),
        premium: parseFloat(orderJson.estados[estado][maxMagnaCity].premium),
        diesel: parseFloat(orderJson.estados[estado][maxMagnaCity].diesel)
      }

    })

    orderJson.timestampGeneracion = new Date().toISOString();
    // ========================
    // ========================
    // ========================

  return orderJson
}

function getDateFrom (item) {
   let rex = /(\d{1,2})\s?[Aa]?[Ll]?\s?(\d{1,2})?\s\w+\s(\w+)\s\w+?\s(\d{4})[.]?/ig
   let match = rex.exec(item);

   return (match[2]) ? `${match[1]} al ${match[2]} de ${capitalize(match[3])} del ${match[4]}` : `${match[1]} de ${capitalize(match[3])} del ${match[4]}`
 }

 function capitalize(s){
   return s.toLowerCase().replace( /\b./g, function(a){ return a.toUpperCase(); } );
 };

function isValidRow( row ){
  return  row[6] !== '' &&  row[5] !== '' &&  row[4] !== ''
}
