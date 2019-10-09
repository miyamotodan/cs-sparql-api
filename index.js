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

  function streamToString (stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
  }

  const result = await engine.query(query, { sources });
  const readable =  (await engine.resultToString(result, 'application/sparql-results+json', result.context)).data;
  const risultato = await streamToString(readable);
  objResult =  JSON.parse( risultato );

  return objResult;

} //END async function handleData()

  console.log('start');

  handleData().then(
  (data) => {

    //console.dir(data, {depth:5});
    console.log(data.results.bindings.length);

    function mapToNode (o, nc, cl, lb) {
      _lb = "";
      eval ('if(o.'+lb+') _lb=o.'+lb+'.value');
      _cl = "";
      eval ('if(o.'+cl+') _cl=o.'+cl+'.value');

      d = {
        id: "n" + nc,
        weight: 30,
        type: 'node',
        label: _lb,
        uri: _cl,
        class: eval('o.'+cl+'.type==="uri"?"Class":"_blank"')
      };
      return {data: d, position: p, group: 'nodes', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    }

    //TODO
    function mapToEdge(o, nt, np, lb, pr) {
      _lb = "";
      eval ('if(o.'+lb+') _lb=o.'+lb+'.value');
      _pr = "";
      eval ('if(o.'+pr+') _cl=o.'+pr+'.value');
      _cl = "";
      if (o.type) _cl = o.type.value;

      d = {
        id: "e" + np,
        weight: 2,
        type: 'edge',
        label: _lb,
        uri: _pr,
        class: _cl,
        source: nt.find(x => x.data.uri === o.class_a.value).data.id,
        target: nt.find(x => x.data.uri === o.class_b.value).data.id
      };
      return {data: d, position: p, group: 'edges', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    }

    console.log("QUERY OK");
    var nc = 1;
    var np = 1;

    p = { x: 0, y: 0 };
    ca = _lh.map(data.results.bindings, (o) => mapToNode(o,nc++, 'class_a', 'class_a_label'));
    cb = _lh.map(data.results.bindings, (o) => mapToNode(o,nc++, 'class_b', 'class_b_label'));

    //unisco lasse_a e classe_b e tolgo i doppioni
    nt = _lh.uniqBy(_lh.concat(ca,cb),'data.uri');

    //CREAZIONE COMPOUND
      function extractPrefix(str) {

        lastSlash = str.lastIndexOf('/');
        lastHash = str.lastIndexOf('#');
        if (lastHash != -1 && lastSlash != -1)
          if (lastHash > lastSlash)
            if (lastHash - lastSlash == 1)
              return str.substring(0, lastSlash + 1)
            else return str.substring(0, lastHash + 1)
          else return str.substring(0, lastSlash + 1)
        if (lastHash != -1) return str.substring(0, lastHash + 1)
        else
          if (lastSlash != -1) return str.substring(0, lastSlash + 1);
          else return "_blank";

      }

      cc = []; // vettore dei compound
      nc = 1; //nuimero dei compound
      lastPr = ""; //parte comune dell'uri

      //lavoro sulle uri ordinate
      sorted_nt = _lh.sortBy(nt, ["data.uri"]);
      sorted_nt.forEach((element, index, array) => {

        pr = extractPrefix(element.data.uri);
        if (lastPr === "") {
          lastPr = pr;
          //inserisco il primo compound
          cc.push({ group: 'nodes', data: { id: "c" + nc++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
        }

        if (pr === lastPr) {
          element.data.parent = "c" + (nc - 1);
        } else {
          console.log(lastPr + " CLOSED ===================================================\n");

          //creo un nuovo compound
          cc.push({ group: 'nodes', data: { id: "c" + nc++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
          //aggiungo l'elemento corrente al compound creato
          element.data.parent = "c" + (nc - 1);

          if (lastPr.startsWith(pr)) {
            cc[nc - 2].data.parent = cc[nc - 3].data.id;
          }
          lastPr = pr;
        }
      });
    //FINE CREAZIONE COMPOUND

    /*
    pp = _lh.map(data.results.bindings, (o) => { return {id : np++, uri : o.objprop.value, label : o.prop_label.value, type : o.type.value, from: o.class_a.value, to: o.class_b.value } });
    pt = _lh.map(pp, (o) => {
      d = { id: "e"+o.id, weight: 2, type: 'edge', label: o.label, uri:o.uri, class: o.type, source: nt.find(x => x.data.uri === o.from).data.id, target: nt.find(x => x.data.uri === o.to).data.id };
      return {data: d, position: p, group: 'edges', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''};
    });
    */
    pt = _lh.map(data.results.bindings, (o) => mapToEdge(o, nt, np++, 'objprop', 'prop_label'));


    //SALVO SU FILE JSON

    let optObj={};

    _fs.readFile('options.json', 'utf-8',  (err, data) => {
      if (err) throw err;

      var graphObj = {id: 1, name: 'nome', graph: [], options : {}}
      var graphVectorObj = { graphs: [] };
      optObj = JSON.parse(data);

      console.log("nodes :"+ sorted_nt.length + ", edges:"+pt.length+ ", compounds:"+cc.length);

      graphObj.graph = [...sorted_nt, ...pt, ...cc];
      graphObj.options = optObj;
      graphVectorObj.graphs.push(graphObj);

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
