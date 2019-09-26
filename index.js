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

    var i = 0;
    resultSet.results.bindings.forEach( (row) => {
        i++
        console.log("## "+i);
        console.log(row);
      }
    );

  })
  .catch(function (error) {
    // Oh noes! 🙀
    console.log("QUERY KO");
    console.log(error);

  });
