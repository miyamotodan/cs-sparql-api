const newEngine = require('@comunica/actor-init-sparql').newEngine;
const _lh = require('lodash');
const _fs = require('fs');

const label = (s) => { if (s == null || s.length == 0) { return 'undefined'; } else { return s } };

const engine = newEngine();

async function handleData() {

  //carico la query SPARQL
  var query = '';
  var sources = [];
  try {
      objQuery =  JSON.parse( _fs.readFileSync('dbpedia.sparql.json', 'utf8') );
      query = objQuery.query.join("\n");
      sources = objQuery.sources;
      console.log(query);
      console.dir(sources, {depth:3});
  } catch(e) {
      console.log('Error reading query:', e.stack);
  }

 /* SOURCES
     { type: "sparql", value: "http://192.168.178.114:9999/blazegraph/sparql" }
     { type: "sparql", value: "http://34.255.72.0/veneto/sparql" }
     { type: "sparql", value: "http://dbpedia.org/sparql" }
     { type: "hypermedia", value: "http://fragments.dbpedia.org/2016-04/en" }
*/

  const result = await engine.query(query, { sources });
  const results = [];
  var tot = 0;

  function fillLiteralValue(record, data, field){
      let o = data.get('?'+field);
      eval('record.'+field+'.value = o.value');
      if (o.language) eval('record.'+field+'.xmllang=o.language');
      eval('record.'+field+'.type="literal"');
  }

  function fillUriValue(record, data, field) {
      let o = data.get('?'+field);
      eval('record.'+field+'.value = o.value');
      eval('record.'+field+'.type = "uri"');
  }

  result.bindingsStream.on('data', data => {
    tot++;
    var i = 0;
    //costruisco una struttura intermedia
    var record = {
      "class_a": { "type": "", "value": "", "xmllang": "" },
      "objprop": { "type": "", "value": "", "xmllang": "" },
      "class_b": { "type": "", "value": "", "xmllang": "" },
      "class_a_label": { "type": "", "value": "", "xmllang": "" },
      "prop_label": { "type": "", "value": "", "xmllang": "" },
      "class_b_label": { "type": "", "value": "", "xmllang": "" },
      "type": { "type": "", "value": "", "xmllang": "" }
    };

    if (data.get('?objprop')) { fillUriValue(record,data,'objprop'); i++ } else objprop.value = "";
    if (data.get('?prop_label')) { fillLiteralValue(record,data,'prop_label'); i++ } else record.prop_label.value = "";
    if (data.get('?class_a')) { fillUriValue(record,data,'class_a');  i++ } else record.class_a.value = "";
    if (data.get('?class_b')) { fillUriValue(record,data,'class_b');  i++ } else record.class_b.value = "";
    if (data.get('?type')) { fillLiteralValue(record,data,'type'); i++ } else record.type.value = "";
    if (data.get('?class_a_label')) { fillLiteralValue(record,data,'class_a_label'); i++ } else record.class_a_label.value = "";
    if (data.get('?class_b_label')) { fillLiteralValue(record,data,'class_b_label'); i++ } else record.class_b_label.value = "";

    console.dir(data, {depth:5});
    //console.log("(" + tot + ")".concat("#".repeat(i)).concat(""+i));
    results.push(record);

  });
  return new Promise(resolve => {
    result.bindingsStream.on('end', () => {
      resolve(results);
    })
  });
} //END async function handleData()


console.log('start');

handleData().then(
  (data) => {

    console.log("QUERY OK");
    var nc = 1;
    var np = 1;

    p = { x: 0, y: 0 };
    ca = _lh.map(data, (o) => { return {id : nc++, uri : o.class_a.value, label : o.class_a_label.value , type:'Class'} });
    cb = _lh.map(data, (o) => { return {id : nc++, uri : o.class_b.value, label : o.class_b_label.value , type:'Class'} });
    //unisco lasse_a e classe_b e tolgo i doppioni
    ct = _lh.uniqBy(_lh.concat(ca,cb),'uri');
    nt = _lh.map(ct, (o) => {
      d = { id: "n"+o.id, weight: 30, type: 'node', label: o.label, uri:o.uri, class: 'Classe' };
      return {data: d, position: p, group: 'nodes', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    });
    //console.dir(nt,{depth:3});

    pp = _lh.map(data, (o) => { return {id : np++, uri : o.objprop.value, label : o.prop_label.value, type : o.type.value, from: o.class_a.value, to: o.class_b.value } });
    // verificare l'unicità... potrebbe non essere corretto
    pp = _lh.uniqBy(pp,'uri');
    pt = _lh.map(pp, (o) => {
      d = { id: "e"+o.id, weight: 2, type: 'edge', label: o.label, uri:o.uri, class: o.type, source: nt.find(x => x.data.uri === o.from).data.id, target: nt.find(x => x.data.uri === o.to).data.id };
      return {data: d, position: p, group: 'edges', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    });

    //console.dir(pt,{depth:3});


    //SALVO SU FILE JSON

    let optObj={};

    _fs.readFile('options.json', 'utf-8',  (err, data) => {
      if (err) throw err;

      var graphObj = {id: 1, name: 'nome', graph: [], options : {}}
      var graphVectorObj = { graphs: [] };
      optObj = JSON.parse(data);

      //graphObj.graph = [...nodes, ...edges];
      graphObj.graph = [...nt, ...pt];
      graphObj.options = optObj;
      graphVectorObj.graphs.push(graphObj);

      //console.dir(graphVectorObj , {depth: 5});

      _fs.writeFile('graph-db.json', JSON.stringify(graphVectorObj,null,2) , 'utf-8', (err) => {
          if (err) throw err;
          console.log('The file has been saved!');
      });

    });


  }).catch(
    (error) => {
      console.log("QUERY KO");
      console.error(error);
    }).finally(
      (data) => {
        console.log('end');
      });
