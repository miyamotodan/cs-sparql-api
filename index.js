const newEngine = require('@comunica/actor-init-sparql').newEngine;
const _lh = require('lodash');
const _fs = require('fs');

const Readable = require('stream').Readable
const Writable = require('stream').Writable
const Transform = require('stream').Transform

const label = (s) => { if (s == null || s.length == 0) { return 'undefined'; } else { return s } };

const engine = newEngine();

//scrivo il grafo nel formato cytoscape su file
async function writeToFile(v) {

  let optObj = {};

  _fs.readFile('config/options.json', 'utf-8', (err, data) => {
    if (err) throw err;

    var graphObj = { id: 1, name: 'nome', graph: [], options: {} }
    var graphVectorObj = { graphs: [] };
    optObj = JSON.parse(data);

    console.log("nodes :" + v[0].length + ", edges:" + v[1].length);

    graphObj.graph = [...v[0], ...v[1]];
    graphObj.options = optObj;
    graphVectorObj.graphs.push(graphObj);

    console.log("created :" + graphObj.graph.length)

    _fs.writeFile('graph-db.json', JSON.stringify(graphVectorObj, null, 2), 'utf-8', (err) => {
      if (err) throw err;
      console.log('The file has been saved!');
    });

  });

}



async function executeQuery(query, sources) {

  function streamToString(stream) {
    const chunks = []
    return new Promise((resolve, reject) => {
      stream.on('data', chunk => chunks.push(chunk))
      stream.on('error', reject)
      stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    })
  }

  const result = await engine.query(query, { sources });
  const readable = (await engine.resultToString(result, 'application/sparql-results+json', result.context)).data;
  const risultato = await streamToString(readable);
  objResult = JSON.parse(risultato);

  return objResult;

} //END async function handleData()

//stampa sulla console la query
function logQuery(query, sources) {

  console.log("");
  console.dir(sources, { depth: 3 });
  console.log('-------------------------------------');
  console.log(query);
  console.log('-------------------------------------');

}

isArray = function(a) {
  return (!!a) && (a.constructor === Array);
};

isObject = function(a) {
  return (!!a) && (a.constructor === Object);
};

function mapToNode(o, nc, cl, lb) {
  //console.log(o.union);
  
  p = { x: Math.random()*100, y: Math.random()*100 };
  
  _lb = "";
  eval('if(o.' + lb + ' && isObject(o.'+lb+')) _lb=o.' + lb + '.value; else _lb=o.' + lb);
  _cl = "";
  eval('if(o.' + cl + ' && isObject(o.'+cl+')) _cl=o.' + cl + '.value; else _cl=o.' + cl);
  _class = "";
  eval('if(o.'+ cl +' && isObject(o.'+cl+')) _class=o.' + cl + '.type==="uri"?"Class":"_blank"; else _class=cl;')

  d = {
    id: "n" + nc,
    weight: 30,
    type: 'node',
    label: _lb,
    uri: _cl,
    class: _class
  };
  return { data: d, position: p, group: 'nodes', removed: false, selected: false, selectable: true, locked: false, grabbable: true, classes: '' };
}

function mapToEdge(o, nt, np, lb, pr) {
  _lb = "";
  eval('if(o.' + lb + ') _lb=o.' + lb + '.value');
  _pr = "";
  eval('if(o.' + pr + ') _cl=o.' + pr + '.value');
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
  return { data: d, position: p, group: 'edges', removed: false, selected: false, selectable: true, locked: false, grabbable: true, classes: '' };
}

//vettore che contiene
// 0: vettore dei nodi, 1: vettore degli archi, 2: vettore dei compound, 3:vettore delle union
var gComp = [];

/**
 * INIZIO PROCESSO
 */
console.log('start');

//carico le query SPARQL
var query = '';
var sources = [];
try {
  objQuery = JSON.parse(_fs.readFileSync('config/veneto.sparql.json', 'utf8'));
} catch (e) {
  console.log('Error reading query:', e.stack);
}

//inizio la pipeline
step1();

function step1() {
  //prendo la query per le classi e le object property
  query = objQuery.query.find(x => x.name === 'ObjectProprties').value.join("\n");
  sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY ObjectProperties OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      var nc = 1;
      var np = 1;

      ca = _lh.map(data.results.bindings, (o) => mapToNode(o, nc++, 'class_a', 'class_a_label'));
      cb = _lh.map(data.results.bindings, (o) => mapToNode(o, nc++, 'class_b', 'class_b_label'));

      //unisco lasse_a e classe_b e tolgo i doppioni
      nt = _lh.uniqBy(_lh.concat(ca, cb), 'data.uri');

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
          //console.log(lastPr + " CLOSED ===================================================\n");

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

      //mappo gli archi
      pt = _lh.map(data.results.bindings, (o) => mapToEdge(o, nt, np++, 'objprop', 'prop_label'));

      gComp = [[...sorted_nt,...cc], pt];

      step2();

    }).catch(
      (error) => {
        console.log("QUERY ObjectProperties KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}

function step2() {
  //prendo la query per le classi e le object property
  query = objQuery.query.find(x => x.name === 'DomainUnions').value.join("\n");
  sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY Unions OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      //console.dir(data,{depth:4});
      gb = _lh.groupBy(data.results.bindings, 'blank.value');
      v = [];
      _lh.forIn(gb, function (value, key) {
        v.push({ blank: key, classes: _lh.map(value, 'class.value') });
      });
      //console.dir(v, {depth:4});

      //console.dir(gb, {depth:4});
      u = [];
      v.forEach((o1) => {
        //se un u non ci sono unioni di classi con la stessa lista di classi di o1 ne creo una nuova
        uv = _lh.filter(u, (o2) => {
          if (o2.classes.length > o1.classes.length)
            return (_lh.difference(o2.classes, o1.classes).length === 0);
          return (_lh.difference(o1.classes, o2.classes).length === 0);
        });
        if (uv.length === 0) {
          new_u = { blank: [o1.blank], classes: o1.classes, union: "u" + u.length };
          u.push(new_u);
        }
        else {
          //altrimenti aggiungo il nodo blank corrente all'unione 
          var i = _lh.findIndex(u, function (o) { return o.union === uv[0].union });
          u[i].blank.push(o1.blank);
        }

      });

      //console.log(u);
      max = _lh.maxBy(gComp[0], (o) => {return parseInt(o.data.id.substring(1)) });
      nc = (max.data.id).substring(1);
      cu = _lh.map(u, (o) => mapToNode(o, nc++, 'union', 'union'));
      //console.log(cu);

      //aggiungo i nuovi nodi
      gComp[0] = [...gComp[0],...cu];


      //scrivo su disco il grafo
      writeToFile(gComp);

    }).catch(
      (error) => {
        console.log("QUERY Unions KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}