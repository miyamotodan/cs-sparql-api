const newEngine = require('@comunica/actor-init-sparql').newEngine;
const _lh = require('lodash');
const _fs = require('fs');

const label = (s) => { if (s == null || s.length == 0) { return 'undefined'; } else { return s } };

const engine = newEngine();

async function handleData() {

  const query = `
  
  PREFIX db: <http://dbpedia.org/resource/>
  PREFIX dbpedia: <http://dbpedia.org/property/>
  select distinct ?class_a ?objprop ?class_b ?class_a_label ?prop_label ?class_b_label ?type
  FROM    <http://dbpedia.org>
  where {
           {
               ?objprop a owl:ObjectProperty .
               ?objprop rdfs:domain ?class_a .
               ?objprop rdfs:range ?class_b .
               OPTIONAL { ?objprop rdfs:label ?prop_label FILTER (lang(?prop_label) = 'en') }.
               OPTIONAL { ?class_a rdfs:label ?class_a_label FILTER (lang(?class_a_label) = 'en') } .
               OPTIONAL { ?class_b rdfs:label ?class_b_label FILTER (lang(?class_b_label) = 'en') }
               BIND("ObjectProperty" AS ?type)
           }
 #        UNION
 #          {
 #              ?objprop a owl:AnnotationProperty .
 #              ?objprop rdfs:domain ?class_a .
 #              ?objprop rdfs:range ?class_b .
 #              OPTIONAL { ?objprop rdfs:label ?prop_label FILTER (lang(?prop_label) = 'en') }.
 #              OPTIONAL { ?class_a rdfs:label ?class_a_label FILTER (lang(?class_a_label) = 'en') } .
 #              OPTIONAL { ?class_b rdfs:label ?class_b_label FILTER (lang(?class_b_label) = 'en') }
 #              BIND("AnnotationProperty" AS ?type)
 #           }
        } 
        #limit 100       
  `;


  const sources = [
    // { type: "sparql", value: "http://192.168.178.114:9999/blazegraph/sparql" }
    // { type: "sparql", value: "http://34.255.72.0/veneto/sparql" }
     { type: "sparql", value: "http://dbpedia.org/sparql" }
    // { type: "hypermedia", value: "http://fragments.dbpedia.org/2016-04/en" }
  ];
  const result = await engine.query(query, { sources });
  const results = [];

  var tot = 0;

  //PROVARE!!!!!
  function fillValue(record, data, field){
      let o = data.get('?'+field);
      cmd = eval('record.'+label+'.value = o.value');
      if (o.language) eval('record.'+label+'.xmllang=o.language');
      eval('record.'+label+'.type="literal"');
  }

  result.bindingsStream.on('data', data => {

    tot++;
    //if (data.get('?class_a').value==="http://dbpedia.org/ontology/Person") console.dir(data.get('?class_a_label').value, {depth:5});
    //if (data.get('?class_b').value==="http://dbpedia.org/ontology/Person") console.dir(data.get('?class_b_label').value, {depth:5});

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

    if (data.get('?objprop')) {
      let o = data.get('?objprop');
      record.objprop.value = o.value; 
      record.objprop.type = "uri"; 
      i++ 
    } else objprop.value = "";
    if (data.get('?prop_label')) { 
      let o = data.get('?prop_label');
      record.prop_label.value = o.value;
      if (o.language) record.prop_label.xmllang=o.language;
      record.prop_label.type="literal";
      i++ 
    } else record.prop_label.value = "";
    if (data.get('?class_a')) {
      let o = data.get('?class_a'); 
      record.class_a.value = o.value;
      record.class_a.type="uri"; 
      i++ 
    } else record.class_a.value = "";
    if (data.get('?class_b')) {
      let o =  data.get('?class_b');
      record.class_b.value = o.value; 
      record.class_b.type="uri"; 
      i++ 
    } else record.class_b.value = "";
    if (data.get('?type')) { 
      let o = data.get('?type');
      record.type.value = o.value; 
      if (o.language) record.type.xmllang=o.language;
      record.type.type="literal";
      i++ 
    } else record.type.value = "";
    if (data.get('?class_a_label')) {
      let o =  data.get('?class_a_label');
      record.class_a_label.value = o.value;
      if (o.language) record.class_a_label.xmllang=o.language; 
      record.class_a_label.type="literal";
      i++ 
    } else record.class_a_label.value = "";
    if (data.get('?class_b_label')) {
      let o = data.get('?class_b_label'); 
      record.class_b_label.value = o.value;
      if (o.language) record.class_b_label.xmllang=o.language; 
      record.class_b_label.type="literal";
      i++ 
    } else record.class_b_label.value = "";

    console.log("(" + tot + ")".concat("#".repeat(i)).concat(""+i));
    results.push(record);
    
  });
  return new Promise(resolve => {
    result.bindingsStream.on('end', () => {
      resolve(results);
    })
  });
}


console.log('start');
handleData().then(
  (data) => {

    console.log("QUERY OK");

    //console.dir(data, {depth:5});

    // RISULTATO
    // { "class_a": { "type": "uri", "value": "http://dbpedia.org/ontology/Person" },
    //   "objprop": { "type": "uri", "value": "http://dbpedia.org/ontology/copilote" },
    //   "class_b": { "type": "uri", "value": "http://dbpedia.org/ontology/Person" },
    //   "class_a_label": { "type": "literal", "xmllang": "en", "value": "person" },
    //   "prop_label": { "type": "literal", "xmllang": "en", "value": "copilote" },
    //   "class_b_label": { "type": "literal", "xmllang": "en", "value": "person" },
    //   "type": { "type": "literal", "value": "ObjectProperty" }
    // }
  
    var classes = [];
    var properties = [];
    var nodes = [];
    var edges = [];
 
    var i = 0;
    var nc = 1;
    var np = 1;
 
    data.forEach( (row) => {
        i++;
        //console.log("## "+i);
        //console.log(row);
        var la='undefined';
        var lb='undefined';
        if (!_lh.isEmpty(row.class_a_label)) la = row.class_a_label.value;
        if (!_lh.isEmpty(row.class_b_label)) lb = row.class_b_label.value;
        if (row.class_a.type=='uri') classes.push({id : nc++, uri : row.class_a.value, label : la , type:'Class'});
        if (row.class_b.type=='uri') classes.push({id : nc++, uri : row.class_b.value, label : lb , type:'Class'});
 
        var la='undefined';
        var lb='undefined';
        if (!_lh.isEmpty(row.prop_label)) la = row.prop_label.value;
        if (!_lh.isEmpty(row.type)) lb = row.type.value;
        if (row.objprop.type=='uri') properties.push({id : np++, uri : row.objprop.value, label : la, type : lb, from: row.class_a.value, to: row.class_b.value });
 
      }
    );
 
    console.log("records read:"+i);
 
    console.log("duplicated classes:"+classes.length+" ("+(nc-1)+")");
    //tolgo le ripetizioni (per uri)
    classes = _lh.uniqBy(classes, 'uri');
    console.log("classes:"+classes.length);
 
    console.log("duplicated properties:"+properties.length+" ("+(np-1)+")");
    //tolgo le ripetizioni (per uri) NON CI DOVREBBERO ESSERE
    properties = _lh.uniqBy(properties, 'uri');
    console.log("properties:"+properties.length);
 
    position = { x: 0, y: 0 };
    var nn = 1;
    classes.forEach ( (c) => {
        data = { id: ""+nn++, weight: 30, type: 'node', label: c.label, uri:c.uri, class: 'Classe' };
        var node = {data: data, position: position, group: 'nodes', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
        nodes.push (node);
        //console.log(node.data.uri)
      }
    );
    //console.log("nodes:"+nodes.length);
 
    var ne = 1;
    properties.forEach ( (p) => {
        //console.log(p.to + " => "+nodes.find(x => x.uri === p.to));
        data = { id: ""+ne++, weight: 2, type: 'edge', label: p.label, uri:p.uri, class: p.type, source: nodes.find(x => x.data.uri === p.from).data.id, target: nodes.find(x => x.data.uri === p.to).data.id };
        var edge = {data: data, position: position, group: 'edges', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
        edges.push (edge);
      }
    );
    //console.log("edges:"+edges.length);
 
 
    let optObj={};
 
    _fs.readFile('options.json', 'utf-8',  (err, data) => {
      if (err) throw err;
 
      var graphObj = {id: 1, name: 'nome', graph: [], options : {}}
      var graphVectorObj = { graphs: [] };
      optObj = JSON.parse(data);
 
      graphObj.graph = [...nodes, ...edges];
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
