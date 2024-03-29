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

    console.log('\n=====================================');
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

isArray = function (a) {
  return (!!a) && (a.constructor === Array);
};

isObject = function (a) {
  return (!!a) && (a.constructor === Object);
};

function mapToNode(o, nc, cl, lb, obj) {
  //console.log(o.union);

  let p = { x: Math.random() * 100, y: Math.random() * 100 };

  let _lb = "";
  eval('if(o.' + lb + ' && isObject(o.' + lb + ')) _lb=o.' + lb + '.value; else _lb=o.' + lb);
  let _cl = "";
  eval('if(o.' + cl + ' && isObject(o.' + cl + ')) _cl=o.' + cl + '.value; else _cl=o.' + cl);
  let _class = "";
  eval('if(o.' + cl + ' && isObject(o.' + cl + ')) _class=o.' + cl + '.type==="uri"?"Class":"_blank"; else _class=cl;')

  let d = {
    id: "n" + nc,
    weight: 30,
    type: 'node',
    label: _lb,
    uri: _cl,
    class: _class
  };
  if (obj !== null) {
    eval('d.' + _lh.keys(obj)[0] + '=obj.' + _lh.keys(obj)[0] + ';');
  }
  return { data: d, position: p, group: 'nodes', removed: false, selected: false, selectable: true, locked: false, grabbable: true, classes: '' };
}

function mapToStaticNode(nc, ur, lb, cl, obj) {
  let p = { x: Math.random() * 100, y: Math.random() * 100 };
  let d = {
    id: "n" + nc,
    weight: 30,
    type: 'node',
    label: lb,
    uri: ur,
    class: cl
  };
  if (obj !== null) {
    eval('d.' + _lh.keys(obj)[0] + '=obj.' + _lh.keys(obj)[0] + ';');
  }
  return { data: d, position: p, group: 'nodes', removed: false, selected: false, selectable: true, locked: false, grabbable: true, classes: '' };
}

function mapToEdge(o, np, src, trg, pr, lb) {
  let p = { x: Math.random() * 100, y: Math.random() * 100 };
  let _lb = "";
  eval('if(o.' + lb + ' && isObject(o.' + lb + ')) _lb=o.' + lb + '.value; else _lb=o.' + lb);
  let _pr = "";
  eval('if(o.' + pr + ' && isObject(o.' + pr + ')) _pr=o.' + pr + '.value; else _pr=o.' + pr);
  let _class = "";
  eval('if(o.type && isObject(o.type)) _class=o.type.value; else _class=_lb');

  d = {
    id: "e" + np,
    weight: 2,
    type: 'edge',
    label: _lb,
    uri: _pr,
    class: _class,
    source: src,
    target: trg
  };
  return { data: d, position: p, group: 'edges', removed: false, selected: false, selectable: true, locked: false, grabbable: true, classes: '' };
}

//vettore che contiene
// 0: vettore dei nodi, 1: vettore degli archi, 2: vettore delle union
var gComp = [];

/**
 * INIZIO PROCESSO
 */
console.log('start');

//carico le query SPARQL
try {
  objQuery = JSON.parse(_fs.readFileSync('config/veneto.sparql.json', 'utf8'));
} catch (e) {
  console.log('Error reading query:', e.stack);
}

//inizio la pipeline
step0();

function step0() {
  //prendo la query per le classi e per costruire i compound
  let query = objQuery.query.find(x => x.name === 'Classes').value.join("\n");
  let sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY Classes OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      //ordino i risultati per class dovessero esserci più label
      //TODO:da gestire le labe lmultiple
      //let vcl = _lh.sortBy(_lh.filter(data.results.bindings, (o) => { return o.class.type === 'uri' }), ["class.value"]);;
      let vcl = _lh.sortBy(data.results.bindings, ["class.value"]);

      let nClass = 1;
      let vcls = _lh.map(vcl, (o) => mapToNode(o, nClass++, 'class', 'label', null));
      
      //aggiungo thing (che non viene dalla query delle classi)
      vcls.unshift(mapToStaticNode(0,'http://www.w3.org/2002/07/owl#Thing','owl:Thing','Class',null));

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

      let vcc = []; // vettore dei compound
      let nComp = 1; //nuimero dei compound
      let lastPr = ""; //parte comune dell'uri

      //lavoro sulle uri ordinate
      vcls.forEach((element, index, array) => {

        let pr = extractPrefix(element.data.uri);
        if (lastPr === "") {
          lastPr = pr;
          //inserisco il primo compound
          vcc.push({ group: 'nodes', data: { id: "c" + nComp++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
        }

        if (pr === lastPr) {
          element.data.parent = "c" + (nComp - 1);
        } else {
          //console.log(lastPr + " CLOSED ===================================================\n");

          //creo un nuovo compound
          vcc.push({ group: 'nodes', data: { id: "c" + nComp++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
          //aggiungo l'elemento corrente al compound creato
          element.data.parent = "c" + (nComp - 1);

          if (lastPr.startsWith(pr)) {
            vcc[nComp - 2].data.parent = vcc[nComp - 3].data.id;
          }
          lastPr = pr;
        }
      });
      //FINE CREAZIONE COMPOUND
      
      //console.dir(vcls,{depth:4});

      //inserisco i nuovi nodi
      gComp = [[...vcls, ...vcc],[]];
      
      //writeToFile(gComp);
      step1();

    }).catch(
      (error) => {
        console.log("QUERY Classes KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}


//costruisce gli i nodi delle classi e gli archi relativi alle object property 
//TODO: DA DIVIDERE !!!
function step1() {
  //prendo la query per le classi e le object property
  let query = objQuery.query.find(x => x.name === 'ObjectProprties').value.join("\n");
  let sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY ObjectProperties OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      /*
      let nClass = 1;
     
      let vca = _lh.map(data.results.bindings, (o) => mapToNode(o, nClass++, 'class_a', 'class_a_label', null));
      let vcb = _lh.map(data.results.bindings, (o) => mapToNode(o, nClass++, 'class_b', 'class_b_label', null));

      //unisco lasse_a e classe_b e tolgo i doppioni
      let vnt = _lh.uniqBy(_lh.concat(vca, vcb), 'data.uri');

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

      let vcc = []; // vettore dei compound
      let nComp = 1; //nuimero dei compound
      let lastPr = ""; //parte comune dell'uri

      //lavoro sulle uri ordinate
      let sorted_vnt = _lh.sortBy(vnt, ["data.uri"]);
      sorted_vnt.forEach((element, index, array) => {

        let pr = extractPrefix(element.data.uri);
        if (lastPr === "") {
          lastPr = pr;
          //inserisco il primo compound
          vcc.push({ group: 'nodes', data: { id: "c" + nComp++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
        }

        if (pr === lastPr) {
          element.data.parent = "c" + (nComp - 1);
        } else {
          //console.log(lastPr + " CLOSED ===================================================\n");

          //creo un nuovo compound
          vcc.push({ group: 'nodes', data: { id: "c" + nComp++, label: pr, type: "node", class: 'compound' }, selectable: false, grabbable: false });
          //aggiungo l'elemento corrente al compound creato
          element.data.parent = "c" + (nComp - 1);

          if (lastPr.startsWith(pr)) {
            vcc[nComp - 2].data.parent = vcc[nComp - 3].data.id;
          }
          lastPr = pr;
        }
      });
      //FINE CREAZIONE COMPOUND
      */

      vnt = gComp[0];

      //console.dir(vnt,{depth:4});

      let nPropr = 1;

      //mappo gli archi
      let vpt = _lh.map(data.results.bindings, (o) => {

        //console.log(o);
        
        //cerco la sorgente
        let src = vnt.find(x => x.data.uri === o.class_a.value);
        if (src) src = src.data.id;
        else console.log('!!!src non trovato!!! : '+o.class_a.value);
        let trg = vnt.find(x => x.data.uri === o.class_b.value)
        if (trg) trg = trg.data.id;
        else console.log('!!!trg non trovato!!! : '+o.class_b.value);
        
        //console.log(src+"-->"+trg);

        //se non ho trovato la sorgente o la destinazione lo lego a thing
        //TODO:vedere se ci sono altre soluzioni...(creare la classe non trovata)
        if (src && trg ) return mapToEdge(o, nPropr++, src, trg, 'objprop', 'prop_label');
        else 
        if (src) return mapToEdge(o, nPropr++, src, 'n0', 'objprop', 'prop_label');
        else return mapToEdge(o, nPropr++, 'n0', trg, 'objprop', 'prop_label');   
      });

      gComp[1] = vpt;    
      step2();
      //writeToFile(gComp);

    }).catch(
      (error) => {
        console.log("QUERY ObjectProperties KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}

//preparo i dati ritornati dalla quey delle union in modo da ottenere le union con l'elenco dei corrispettivi nodi blank e classi
//questa è l'anagrafica delle union che deve essere usata anche dopo negli altri passi
function step2_1(data) {

  //raggruppo i risultati per blank node : blank --> lista classi
  let vgb = _lh.groupBy(data.results.bindings, 'blank.value');
  //console.dir(vgb,{depth:4})

  //riduco vgb tenendo il blank node e l'uri delle classi
  let v = [];
  _lh.forIn(vgb, function (value, key) {
    v.push({ blank: key, classes: _lh.map(value, 'class.value') });
  });

  //in u metto insieme i nodi blank che hanno le stesse classi in union
  let u = [];
  v.forEach((o1) => {
    //se in u[] non ci sono unioni di classi con la stessa lista di classi di o1 ne creo una nuova
    let uv = _lh.filter(u, (o2) => {
      if (o2.classes.length > o1.classes.length)
        return (_lh.difference(o2.classes, o1.classes).length === 0);
      return (_lh.difference(o1.classes, o2.classes).length === 0);
    });
    if (uv.length === 0) {
      let new_u = { blank: [o1.blank], classes: o1.classes, union: "u" + u.length };
      u.push(new_u);
    }
    else {
      //altrimenti aggiungo il nodo blank corrente all'unione
      let i = _lh.findIndex(u, function (o) { return o.union === uv[0].union });
      u[i].blank.push(o1.blank);
    }

  });

  return u;

}

//costruisce i nodi per le classi anonime in union e li collega alle classi unite
function step2() {
  //prendo la query per le unions
  let query = objQuery.query.find(x => x.name === 'Unions').value.join("\n");
  let sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY Unions OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      let u = step2_1(data);
      //salvo l'anagrafica delle union per i prossimi step
      gComp[2] = u;

      //calcolo il massimo tra gli ID dei nodi
      let max = _lh.maxBy(gComp[0], (o) => { return parseInt(o.data.id.substring(1)) });

      let nProp = parseInt((max.data.id).substring(1));
      //creo i nodi relativi alla union
      let vcu = _lh.map(u, (o) => mapToStaticNode(nProp++, '' + o.classes.toString(), o.union, 'union', { blank: o.blank }));

      //aggiungo i nuovi nodi
      gComp[0] = [...gComp[0], ...vcu];

      //calcolo il massimo tra gli ID degli archi
      max = _lh.maxBy(gComp[1], (o) => { console.log('#');console.log(o); return parseInt(o.data.id.substring(1)) });
      let nt = (max.data.id).substring(1);
      let vee = [];
      u.forEach((nn) => {

        //scorro le classi dell'unione
        for (let i = 0; i < nn.classes.length; i++) {
          //ricavo l'id
          bid = gComp[0].find(x => x.data.uri === nn.classes[i]);
          if (bid) {
            bid = bid.data.id;
            //console.log("bid:"+bid);

            //ricavo l'id (attenzione assumo che la label del nodo dell'unione abbia il nome dell'union 'nx')
            uid = gComp[0].find(x => x.data.label === nn.union);
            if (uid) {
              uid = uid.data.id;
              //creo un arco dalla classe al nodo dell'unione
              //console.log("uid:"+uid);
              vee.push(mapToEdge({ label: 'union', property: 'owl:unionOf' }, nt++, bid, uid, 'property', 'label'));
            }
          }
        }
      });

      //aggiungo i nuovi archi
      gComp[1] = [...gComp[1], ...vee];

      //scrivo su disco il grafo
      //writeToFile(gComp);
      step3();

    }).catch(
      (error) => {
        console.log("QUERY Unions KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}

function step3_1(data) {

  let u = step2_1(data);

  //calcolo il massimo tra gli ID degli archi
  max = _lh.maxBy(gComp[1], (o) => { return parseInt(o.data.id.substring(1)) });
  nt = (max.data.id).substring(1);

  u.forEach((nn) => {

    //scorro i nodi _blank che rappresentano l'unione
    for (let i = 0; i < nn.blank.length; i++) {
      //ricavo l'id
      bid = gComp[0].find(x => x.data.uri === nn.blank[i]);
      if (bid) {
        bid = bid.data.id;
        //elimino il nodo
        r = _lh.remove(gComp[0], function (n) { return n.data.id === bid; });

        //ricavo l'id (attenzione assumo che la label del nodo dell'unione abbia il nome dell'union 'nx')
        uid = gComp[0].find(x => x.data.label === nn.union);
        if (uid) {
          uid = uid.data.id;

          //trovo tutti gli archi che hanno source in quel nodo
          var se = _lh.keys(_lh.pickBy(gComp[1], function (o) { return (o.data.source === bid) }));
          //li sposto sull'unione
          se.forEach((n) => { gComp[1][n].data.source = uid });

          //trovo tutti gli archi che hanno target in quel nodo
          var te = _lh.keys(_lh.pickBy(gComp[1], function (o) { return (o.data.target === bid) }));
          //li sposto sull'unione
          te.forEach((n) => { gComp[1][n].data.target = uid });
        }

      }
    }


  });



}

//modifica gli archi per le property che hanno classi anonime come domain
function step3() {
  //prendo la query per le union che sono domain di propery
  query = objQuery.query.find(x => x.name === 'DomainRangeUnions').value.join("\n");
  sources = objQuery.sources;
  logQuery(query, sources);
  //eseguo la query
  executeQuery(query, sources).then(
    (data) => {
      console.log("QUERY DomainRangeUnions OK");
      console.log("resultSet rows: " + data.results.bindings.length);

      step3_1(data);

      //scrivo su disco il grafo
      writeToFile(gComp);

    }).catch(
      (error) => {
        console.log("QUERY DomainRangeUnions KO");
        console.error(error);
      }).finally(
        (data) => {

        });
}