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
      objQuery =  JSON.parse( _fs.readFileSync('veneto.sparql.json', 'utf8') );
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
      //console.dir(data,{depth:4});
      if (o.constructor.name === 'NamedNode')
        eval('record.'+field+'.type = "uri"');
      else
        eval('record.'+field+'.type = "blank"');
  }

  result.bindingsStream.on('data', data => {
    tot++;
    var i = 0;
    //costruisco una struttura intermedia come se fosse ritornata da una select SPARQL
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

    //onsole.dir(data, {depth:6});
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

    function mapToNode (o, nc, cl, lb) {
      d = {
        id: "n" + nc,
        weight: 30,
        type: 'node',
        label: eval('o.'+lb+'.value'),
        uri: eval('o.'+cl+'.value'),
        class: eval('o.'+cl+'.type==="uri"?"Class":"_blank"')
      };
      return {data: d, position: p, group: 'nodes', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    }

    //TODO
    function mapToEdge() { }

    console.log("QUERY OK");
    var nc = 1;
    var np = 1;

    p = { x: 0, y: 0 };
    ca = _lh.map(data, (o) => mapToNode(o,nc++, 'class_a', 'class_a_label'));
    cb = _lh.map(data, (o) => mapToNode(o,nc++, 'class_b', 'class_b_label'));

    //unisco lasse_a e classe_b e tolgo i doppioni
    nt = _lh.uniqBy(_lh.concat(ca,cb),'data.uri');
    //console.dir(nt,{depth:3});

    //ESPERIMENTO SULLA CREAZIONE DI NODI AGGIUNTIVI PER CREARE COMPOUND

          function extractPrefix(str) {

            lastSlash=str.lastIndexOf('/');
            lastHash=str.lastIndexOf('#');
            if (lastHash!=-1 && lastSlash!=-1)
              if (lastHash>lastSlash)
                  if (lastHash-lastSlash==1)
                  return str.substring(0,lastSlash+1)
                  else return str.substring(0,lastHash+1)
              else return str.substring(0,lastSlash+1)
            if ( lastHash != -1) return str.substring(0,lastHash+1)
            else
            if ( lastSlash != -1) return str.substring(0,lastSlash+1);
            else return "_blank";

          }

          cc = []; // vettore dei compound
          nc = 1; //nuimero dei compound
          lastPr = ""; //parte comune dell'uri

          sorted_nt = _lh.sortBy(nt, ["data.uri"]);
          //console.log(_lh.map(sorted_nt, (o) => {return o.data.uri + "-->" + extractPrefix( o.data.uri) } ))

          sorted_nt.forEach((element,index,array) => {

            pr = extractPrefix(element.data.uri);
            if (lastPr==="") {
                lastPr = pr;
                //inserisco il primo compound
                cc.push({ group: 'nodes', data : { id: "c" + nc++, label: pr ,type: "node", class : 'compound'}, selectable: false, grabbable: false });
            }

            if (pr===lastPr) {
              element.data.parent = "c" + (nc-1);
            } else {
              console.log(lastPr+" CLOSED ===================================================\n");

              //creo un nuovo compound
              cc.push({ group: 'nodes', data : { id: "c" + nc++, label: pr ,type: "node", class : 'compound'}, selectable: false, grabbable: false });
              //aggiungo l'elemento corrente al compound creato
              element.data.parent = "c" + (nc-1);

              if (lastPr.startsWith(pr)) {
                  cc[nc-2].data.parent = cc[nc-3].data.id;
                  //console.log(cc[nc-2]);
                  //console.log(cc[nc-3]);
              }

              lastPr = pr;


            }

          });

          //console.dir(cc, {depth:3});
          //console.dir(sorted_nt, {depth:6});
    //==================================================================

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
      graphObj.graph = [...sorted_nt, ...pt, ...cc];
      graphObj.options = optObj;
      graphVectorObj.graphs.push(graphObj);

      //console.dir(graphVectorObj , {depth: 5});
      console.log("created :"+ graphObj.graph.length)

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
