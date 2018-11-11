// Dependencies
var fs = require('fs');
var http = require('http');
var exec = require('child_process').exec;



var cmdLineArgs = process.argv.slice(2);
var parameters = { host: 'video', port:'7080', limit: 5, tokenFile: './token.json', directory: './downloads'};
var file_name, file, securityCamVideos, currentVideo, responseBuffer="", downloadCount = 0, safeToDelete = { recordingsList:[] };

getArgs();
//console.log( "parameters object : ", JSON.stringify(parameters, undefined, 4), "\n");    


// We will be downloading the files to a directory, so make sure it's there
// This step is not required if you have manually created the directory
var mkdir = 'mkdir -p ' + parameters.directory;
var child = exec(mkdir, function(err, stdout, stderr) {
    if (err) throw err;
    else getVideoList()
});

// Get videos that are available
function getVideoList() {
    const options = {
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'application/json, text/javascript, */*; q=0.01',
            'Accept-Language':'en-GB,en;q=0.5',
            'Content-Type':'application/json'            
        }
    };

    let videoListUrl = "http://" + parameters.host + ":" + parameters.port 
        + "/api/2.0/recording?idsOnly=true&sortBy=startTime&sort=desc&apiKey=" + parameters.accessToken;
    // Example header received from the Unifi Video API
    // Content-Disposition attachment; filename=20181014.091120.FrontYard.mp4; filename*=UTF-8''20181014.091120.FrontYard.mp4
    http.get(videoListUrl, options, function(res) {
        //console.log(`STATUS: ${res.statusCode}`);
        if (res.statusCode < 300) {
            //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            res.on('data', function(data) {
                responseBuffer += data;
            }).on('end', function() {
                let rawList = JSON.parse(responseBuffer);
                securityCamVideos = rawList.data;
                console.log('\nSecurity Camera video list : ' + securityCamVideos.length);
                downloadNext();
            });    
        }
    });
};


function downloadNext() {
    let next = securityCamVideos.pop();
    if (next){
        file_name = null;
        file = null;
        currentVideo = next;

        let file_url = "http://" + parameters.host + ":" + parameters.port  + "/api/2.0/recording/" + next + '/download?apiKey=' + parameters.accessToken;
        if (downloadCount < parameters.limit){
            download_file_httpget(file_url);
        } else writeSafeToDeleteFile();
    } else writeSafeToDeleteFile();
}

function writeSafeToDeleteFile(){
    console.log( "\nCreating safe-to-delete file.\n")
    // URI for deleting files http://video:7080/api/2.0/recording/deleteRecordingIds?apiKey=<ACCESS_TOKEN>
    let downloadedFiles = fs.createWriteStream( parameters.directory + 'safe-to-delete.json');
    downloadedFiles.write(  JSON.stringify( safeToDelete ));
    downloadedFiles.end();
}

// Function to download file using HTTP.get
function download_file_httpget(file_url) {
    const options = {
        headers: {
            'Accept-Encoding': 'gzip, deflate, br',
            'Accept': 'application/json, text/javascript, */*; q=0.01'
        }
    };

    // Example header received from the Unifi Video API
    // Content-Disposition attachment; filename=20181014.091120.FrontYard.mp4; filename*=UTF-8''20181014.091120.FrontYard.mp4
    http.get(file_url, options, function(res) {
        if (res.statusCode < 300) {
            //console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
            let headers = res.headers;
            let contentDisposition = headers['content-disposition']
            let parts = contentDisposition.split(';');
            for (let part of parts) {
                part = part.trim();
                let n = part.indexOf("filename=");
                if (n > -1) {
                    // console.log("content-disposition : ", part);
                    file_name = part.substr(n+9);
                    file = fs.createWriteStream(parameters.directory + file_name);
                    break;
                }
            }
        
            res.on('data', function(data) {
                file.write(data);
            }).on('end', function() {
                file.end();
                console.log('wrote : ' + file_name + ' downloaded to ' + parameters.directory );
                downloadCount++;
                safeToDelete.recordingsList.push( currentVideo );
                downloadNext()
            });    
        } else {
            console.log(`STATUS: ${res.statusCode}`);
        }
    });
};


function getArgs(){
    //console.log('Args: ', cmdLineArgs);
    console.log(`
    
    node download-unif-video.js [--host=<HOST_NAME>] [--port=<PORT_NO>] [--limit=<DOWNLOAD_LIMIT>] [--token-file=<TOKEN_FILENAME>] [--directory=<DOWNLOAD_DIRECTORY>]
    
      Command Line arguments:
        --host=<The unifi server's hostname> default=video
        --port=<The unifi server's port> default=7080
        --limit=<The number of files to download> default=5
        --token-file=<the file with the unifi server's access token> default=token.json
        --directory=<the directory to download the files to> default=./downloads
    
      Verbose format example:
        node download-unif-video.js --host=video --port=7080 --limit=5 --token-file=token.json --directory=./downloads
    
      Short format example:
        node download-unif-video.js -h=video -p=7080 -l=5 -t=token.json -d=./downloads
    `)
    
    for (let arg of cmdLineArgs) {
        arg = arg.trim();
        let parts = arg.split('=');
        let key = '', value = '';
        if ( parts[0] ) key = parts[0].trim();
        if ( parts[1] ) value = parts[1].trim();
    
        //console.log( "Key : " + key);
    
        if ( key === "--host" || key === "-h" ) parameters.host = value;
        if ( key === "--port" || key === "-p" ) parameters.port = value;
        if ( key === "--limit" || key === "-l" ) parameters.limit = value;
        if ( key === "--token-file" || key === "-t" ) parameters.tokenFile = value;
        if ( key === "--directory" || key === "-d" ) parameters.directory = value;
    }

    if ( !parameters.directory.endsWith("/") ) parameters.directory += "/"
    
    //console.log( "parameters object : ", JSON.stringify(parameters), "\nReading Access Token File: ");
    
    let fileData = fs.readFileSync(parameters.tokenFile);
    let tokenObject = JSON.parse(fileData);
    parameters.accessToken = tokenObject.accessToken;
}

