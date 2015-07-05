#!/bin/env node

// Require modules

var express = require('express');
var app = express();
var db = require('mongo-lite').connect('mongodb://' + process.env.MONGO_USERNAME + ':' + process.env.MONGO_PASSWORD + '@dharma.mongohq.com:10042/CiteIt', ['citeit']);

// Configuration

app.configure(function () {
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
});

app.set('view options', {
  layout: false
});

app.use('/javascripts', express.static(__dirname + '/javascripts'));
app.use('/stylesheets', express.static(__dirname + '/stylesheets'));

// Frontend

app.get('/', function (request, response) {
  if (request.headers.host == 'citeit.herokuapp.com') {
    response.render(__dirname + '/index.ejs');
  } else {
    response.redirect('http://citeit.herokuapp.com');
  }
});

app.get('/:bibliography', function (request, response) {
  var name = request.params.bibliography;

  if (request.headers.host == 'citeit.herokuapp.com') {
    if (/^[\w-]+$/.test(name)) {
      var date = new Date();

      db.citeit.first({
        _id: name
      }, function (error, value) {
        if (!value) {
          // Create the bibliography
          var newValue = {
            _id: name,
            sources: 'Book with an Author|||||||',
            citation: '',
            lastViewed: getStringFromDate(date),
          };
          db.citeit.insert(newValue, function (returnedError, returnedValue) {
            if (returnedError) {
              response.redirect('/');
            } else {
              response.render(__dirname + '/bibliography.ejs', {
                bibliography: newValue
              });
            }
          });
        } else if (error) {
          // Database error; go to home page
          response.redirect('/');
        } else {
          // Render the bibliography
          response.render(__dirname + '/bibliography.ejs', {
            bibliography: value
          });

          // Update the last viewed date in the database
          db.citeit.update({
            _id: name
          }, {
            $set: {
              lastViewed: getStringFromDate(date),
            }
          }, function (returnedError, returnedValue) {
            // Empty callback
          });
        }
      });
    } else {
      response.send(404);
    }
  } else {
    response.redirect('http://citeit.herokuapp.com/' + name);
  }
});

// Backend

app.post('/save', function (request, response) {
  // Create an object with all of the sources
  var rawSources = request.body;
  var name = rawSources.name;
  delete rawSources.name;

  // Sort the sources
  var sourceKeys = Object.keys(rawSources);

  for (var i = 0; i < sourceKeys.length; i++) {
    sourceKeys[i] = sourceKeys[i].split('').reverse().join('');
  }
  sourceKeys = sourceKeys.sort();

  // Create an array with the sources
  var sources = new Array();
  for (var i = 0; i < sourceKeys.length; i++) {
    var sourceKeyString = sourceKeys[i].split('').reverse().join('');
    var information = rawSources[sourceKeyString].trim();

    var sourceKeyParts = sourceKeys[i].split('-');
    var sourceNumber = parseInt(sourceKeyParts[0]) - 1;

    if (sources[sourceNumber]) {
      // Concatenate the string to the existing source string
      sources[sourceNumber] = sources[sourceNumber].concat('|' + information);
    } else {
      // Create a new string and add the first bit of information
      sources[sourceNumber] = information;
    }
  }

  var sourcesString = sources.join('~');

  // Update the bibliography
  db.citeit.update({
    _id: name
  }, {
    $set: {
      sources: sourcesString,
      citation: generateCitation(sourcesString)
    }
  }, function (error, value) {
    // Redirect to the bibliography page. If updating was successful, the changes
    // will be shown; if not, the old version of the bibliography will be shown.
    response.redirect('http://citeit.herokuapp.com/' + name);
  });
});

// Generate a citation given a source string
function generateCitation(sourcesString) {
  // Split the string into individual source strings
  var sources = sourcesString.split('~');

  // Create an empty citation array
  var citations = new Array();

  // Iterate through the source strings to create citation
  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];

    var parts = source.split('|');

    if (!checkIfBlank(parts)) {
      var sourceCitation = '';

      // Find the type of source and cite based on that
      if (parts[0] == 'Book with an Author') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[3] + '</i>. ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat(parts[4] + ': ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + ', ');
        } else {
          sourceCitation = sourceCitation.concat('n.p., ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6] + '. ');
        }
        sourceCitation = sourceCitation.concat('Print.');
      } else if (parts[0] == 'Book with an Editor') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + ', Ed. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', Ed. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + ', Ed. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[3] + '</i>. ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat(parts[4] + ': ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + ', ');
        } else {
          sourceCitation = sourceCitation.concat('n.p., ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6] + '. ');
        }
        sourceCitation = sourceCitation.concat('Print.');
      } else if (parts[0] == 'General Encyclopedia') {
        if (parts[1] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[1] + '." ');
        }
        if (parts[2] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[2] + '</i>. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat(parts[3] + ' ed. ');
        }
        sourceCitation = sourceCitation.concat('Print.');
      } else if (parts[0] == 'Specialty Encyclopedia, Dictionary, or Other Reference Book') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[3] + '." ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[4] + '</i>. ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + ': ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6] + ', ');
        } else {
          sourceCitation = sourceCitation.concat('n.p., ');
        }
        if (parts[7] != '') {
          sourceCitation = sourceCitation.concat(parts[7] + '. ');
        }
        sourceCitation = sourceCitation.concat('Print.');
      } else if (parts[0] == 'Multi-Volume Specialty Encyclopedia') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[3] + '." ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat(parts[4] + ': ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + ', ');
        } else {
          sourceCitation = sourceCitation.concat('n.p., ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6]);
        }
        if (parts[7] != '') {
          sourceCitation = sourceCitation.concat('. Volume ' + parts[7]);
        }
        if (parts[8] != '') {
          sourceCitation = sourceCitation.concat(' of ' + parts[8]);
        }
        sourceCitation = sourceCitation.concat('. Print.');
      } else if (parts[0] == 'Magazine or Newspaper') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[3] + '." ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[4] + '</i>. ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + ': ');
        } else {
          sourceCitation = sourceCitation.concat('n.d., ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6] + '. ');
        } else {
          sourceCitation = sourceCitation.concat('n. pag. ');
        }
        sourceCitation = sourceCitation.concat('Print.');
      } else if (parts[0] == 'Website') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[3] + '." ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[4] + '</i>. ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat(parts[5] + '. ');
        } else {
          sourceCitation = sourceCitation.concat('n.d. ');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(parts[6] + '. ');
        } else {
          sourceCitation = sourceCitation.concat('n.p. ');
        }
        sourceCitation = sourceCitation.concat('Web.');
        if (parts[7] != '') {
          sourceCitation = sourceCitation.concat(' ' + parts[7] + '.');
        }
      } else if (parts[0] == 'Media from the Web') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat('"' + parts[3] + '." ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat('Online ' + parts[4] + '. ');
        }
        if (parts[5] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[5] + '</i>.');
        }
        if (parts[6] != '') {
          sourceCitation = sourceCitation.concat(' ' + parts[6] + '.');
        }
      } else if (parts[0] == 'Interview') {
        if (parts[2] != '' && parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + ', ' + parts[1] + '. ');
        } else if (parts[2] != '') {
          sourceCitation = sourceCitation.concat(parts[2] + '. ');
        } else if (parts[1] != '') {
          sourceCitation = sourceCitation.concat(parts[1] + '. ');
        }
        sourceCitation = sourceCitation.concat('Personal Interview. ');
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat(parts[3] + '.');
        } else {
          sourceCitation = sourceCitation.concat('n.d.');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat(' ' + parts[4] + '.');
        }
      } else if (parts[0] = 'Video Recording or DVD') {
        if (parts[1] != '') {
          sourceCitation = sourceCitation.concat('<i>' + parts[1] + '</i>. ');
        }
        if (parts[2] != '') {
          sourceCitation = sourceCitation.concat('Dir. ' + parts[2] + '. ');
        }
        if (parts[3] != '') {
          sourceCitation = sourceCitation.concat(parts[3] + ', ');
        }
        if (parts[4] != '') {
          sourceCitation = sourceCitation.concat(parts[4] + '. ');
        }
        sourceCitation = sourceCitation.concat('Film.');
      }

      citations.push(sourceCitation);
    }
  }

  // Sort the citations alphabetically
  var alphabetizedCitations = sortCitations(citations);

  // Return the full citation
  var citationHTML = alphabetizedCitations.join('<br><br>')
  return citationHTML;
}

// Check if a citation is blank
function checkIfBlank(partsArray) {
  // Set is blank initially to true. If any element in partsArray is not empty,
  // the execution of the loop will be broken and the loop will return true;
  var isBlank = true;

  // Start checking elements. Avoid the first element, because that's they type
  // and will therefore never be blank.
  for (var i = 1; i < partsArray.length; i++) {
    if (partsArray[i] != '') {
      isBlank = false;
      break;
    }
  }

  return isBlank;
}

// Sort the citations alphabetically
function sortCitations(citationsArray) {
  // Iterate through the citations and generate an array of objects for sorting
  var arrayToSort = new Array();

  // Get only letters and numbers from string
  for (var i = 0; i < citationsArray.length; i++) {
    var citationObject = new Object();
    citationObject.real = citationsArray[i];
    citationObject.modified = citationsArray[i].replace(/[^\w\s]|_/g, '').replace(/\s+/g, '').trim();
    arrayToSort.push(citationObject);
  }

  // Perform custom sort
  var sortedObjects = arrayToSort.sort(function (itemOne, itemTwo) {
    return itemOne.modified.localeCompare(itemTwo.modified);
  });

  // Return sorted original array
  var sortedArray = new Array();
  for (var i = 0; i < sortedObjects.length; i++) {
    sortedArray.push(sortedObjects[i].real);
  }
  return sortedArray;
}

// Convert a Date object into an (M)M/(D)D/YYYY string
function getStringFromDate(date) {
  var dateString = date.getDate().toString();
  var monthString = (date.getMonth() + 1).toString();
  var yearString = date.getFullYear().toString();

  return monthString + '-' + dateString + '-' + yearString;
}

// Start the app
var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Starting CiteIt on port ' + port.toString());
});