const newEngine = require('@comunica/actor-init-sparql').newEngine;
const _lh = require('lodash');
const _fs = require('fs');

const Readable = require('stream').Readable
const Writable = require('stream').Writable
const Transform = require('stream').Transform

const label = (s) => { if (s == null || s.length == 0) { return 'undefined'; } else { return s } };

const engine = newEngine();

async function handleData() {

  //carico la query SPARQL
  var query = '';
  var sources = [];
  try {
      objQuery =  JSON.parse( _fs.readFileSync('dbpedia.sparql.json', 'utf8') );
      //prendo la query per le classi e le object property
      query = objQuery.query.find(x => x.name === 'classes').value.join("\n");
      sources = objQuery.sources;

      console.dir(sources, {depth:3});
      console.log('-------------------------------------');
      console.log(query);
      console.log('-------------------------------------');

  } catch(e) {
      console.log('Error reading query:', e.stack);
  }

  risultato = "";
  const result = await engine.query(query, { sources });
  const readable =  (await engine.resultToString(result, 'application/sparql-results+json', result.context)).data;
  var wstream = _fs.createWriteStream('myOutput.txt');
  let stream = readable.pipe(wstream);
  stream.on('finish', () => {
     
    objResult =  JSON.parse( _fs.readFileSync('myOutput.txt', 'utf8') );
    console.dir(objResult,{depth:5});
  

  });

  
} //END async function handleData()


  console.log('start');

  handleData().then(
  (data) => {

    console.dir(data, {depth:4});

  }).catch(
    (error) => {
      console.log("QUERY KO");
      console.error(error);
    }).finally(
      (data) => {
        console.log('end');
      });
