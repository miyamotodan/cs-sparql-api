var _lh = require('lodash');

const label = (s) => {if (s==null || s.length==0) { return 'undefined';} else {return s}};

const SparqlClient = require('sparql-client-2');
const SPARQL = SparqlClient.SPARQL;
const endpoint = 'http://dbpedia.org/sparql';

// Get the leaderName(s) of the given city
//const city = 'Vienna';
//const query =
  // SPARQL`PREFIX db: <http://dbpedia.org/resource/>
  //        PREFIX dbpedia: <http://dbpedia.org/property/>
  //        SELECT ?leaderName
  //        FROM <http://dbpedia.org>
  //        WHERE {
  //          ${{db: city}} dbpedia:leaderName ?leaderName
  //        }
  //        LIMIT 10`;

const query =
  SPARQL `
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
            UNION
            {
                ?objprop a owl:AnnotationProperty .
                ?objprop rdfs:domain ?class_a .
                ?objprop rdfs:range ?class_b .
                OPTIONAL { ?objprop rdfs:label ?prop_label FILTER (lang(?prop_label) = 'en') }.
                OPTIONAL { ?class_a rdfs:label ?class_a_label FILTER (lang(?class_a_label) = 'en') } .
                OPTIONAL { ?class_b rdfs:label ?class_b_label FILTER (lang(?class_b_label) = 'en') }
                BIND("AnnotationProperty" AS ?type)
            }
        } `;


const client = new SparqlClient(endpoint)
  .register({db: 'http://dbpedia.org/resource/'})
  .register({dbpedia: 'http://dbpedia.org/property/'});

client.query(query)
  .execute()
  .then(function (resultSet) {
    console.log("QUERY OK");

    // RISULTATO
    // { "class_a": { "type": "uri", "value": "http://dbpedia.org/ontology/Person" },
    //   "objprop": { "type": "uri", "value": "http://dbpedia.org/ontology/copilote" },
    //   "class_b": { "type": "uri", "value": "http://dbpedia.org/ontology/Person" },
    //   "class_a_label": { "type": "literal", "xmllang": "en", "value": "person" },
    //   "prop_label": { "type": "literal", "xmllang": "en", "value": "copilote" },
    //   "class_b_label": { "type": "literal", "xmllang": "en", "value": "person" },
    //   "type": { "type": "literal", "value": "ObjectProperty" }
    // }

    //console.dir(resultSet.results, {depth: null});

    var classes = [];
    var properties = [];
    var nodes = [];
    var edges = [];

    var i = 0;
    var nc = 1;
    var np = 1;
    resultSet.results.bindings.forEach( (row) => {
        i++
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
        if (row.objprop.type=='uri') properties.push({id : nc++, uri : row.objprop.value, label : la, type : lb, from: row.class_a.value, to: row.class_b.value }); 

      }
    );
    
    console.log("duplicated classes:"+classes.length);
    //tolgo le ripetizioni (per uri)
    classes = _lh.uniqBy(classes, 'uri');
    console.log("classes:"+classes.length);
    
    console.log("duplicated properties:"+properties.length);
    //tolgo le ripetizioni (per uri) NON CI DOVREBBERO ESSERE
    properties = _lh.uniqBy(properties, 'uri');
    console.log("properties:"+properties.length);

    var nn = 1;
    classes.forEach ( (c) => {
        data = { id:nn++, weight: 30, type: 'node', label: c.label, uri:c.uri, class: 'Classe' };
        var node = {data: data, group: 'nodes', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''}; 
        nodes.push (node);
      }
    );
    console.log("nodes:"+nodes.length);

    var ne = 1;
    properties.forEach ( (p) => {
        data = { id:ne++, weight: 2, type: 'edge', label: p.label, uri:p.uri, class: p.type, source: 0, target: 0 };
        var edge = {data: data, group: 'edges', removed : false, selected: false, selectable: true, locked: false, grabbable: true, classes: ''}; 
        edges.push (edge);
      }
    );
    console.log("edges:"+edges.length);

  })
  .catch(function (error) {
    // Oh noes! 🙀
    console.log("QUERY KO");
    console.log(error);

  });
