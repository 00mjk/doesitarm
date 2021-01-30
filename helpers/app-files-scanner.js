// import { fs, configure, ZipReader, BlobReader }
// import * as zip from '@zip.js/zip.js'

// import { promises as fs } from 'fs'
// import MarkdownIt from 'markdown-it'
// import slugify from 'slugify'
// import axios from 'axios'

// import statuses from './statuses'
// import parseGithubDate from './parse-github-date'

const knownArchiveExtensions = new Set([
    'app',
    'dmg',
    // 'pkg',
    'zip',
    // 'gz',
    // 'bz2'
])

const notAppFileTypes =  new Set([
    'image',
    'text',
    'audio',
    'video'
])

const knownAppExtensions =  new Set([
    '.app',
    '.app.zip'
])

function isString( maybeString ) {
    return (typeof maybeString === 'string' || maybeString instanceof String)
}

function isValidHttpUrl( string ) {
    if ( !isString( string ) ) return false

    let url

    try {
        url = new URL(string)
    } catch (_) {
        return false
    }

    return url.protocol === "http:" || url.protocol === "https:"
}

let zip

export default class AppFilesScanner {

    constructor( { observableFilesArray } ) {
        // Files to process
        this.files = observableFilesArray

        // https://gildas-lormeau.github.io/zip.js/
        zip = require('@zip.js/zip.js')

        // https://gildas-lormeau.github.io/zip.js/core-api.html#configuration
        zip.configure({
            workerScripts: true,
            // workerScripts: {
            //     inflate: ["lib/z-worker-pako.js", "pako_inflate.min.js"]
            // }
        })
    }


    isApp ( file ) {

        if ( file.type.includes('/') && notAppFileTypes.has( file.type.split('/')[0] ) ) return false

        return true
    }

    getStatusMessage () {
        // 'Drag and drop one or multiple apps'

        // return `Searching for apps at ${ file.url }`


    }

    getFileStatusMessage ( file ) {


        // CORS error - 'This page has asked not to be scanned. '

        // Status Code Error - 'This page is not loading properly. '

        // No app urls found - 'No apps found on this page. Try a different page or entering the package URL directly. You can also manually download the package then drop it on here. '

        // 'Found # apps'

        // Fetching / File Loading from drag and drop - 'Loading # apps'

        // Unzipping, archive search and Parsing - 'Processing # of #'

        // Not able to unzip - 'Unable to open package. Try a different file. '

        // No Mach-o binary found - 'Could not find Mac App data in package. Try a different package. '

        // Mach-o Parsing Error - 'Unable to scan package. Try a different one. '

        // No ARM64 Architecture found - 'This App's binary is not compatible with Apple Silicon and will only run via Rosetta 2 translation, however, software vendors will sometimes will ship separate install files for Intel and ARM instead of a single one. You can try submitting the download page link for an app and we'll scan that. '

        // ARM64 Architecture found -
        return 'This App is natively compatible with Apple Silicon!'
    }


    // async scanPageForAppUrls () {

    // }

    // async downloadArchiveFromUrl () {

    // }

    async unzipFile ( file ) {
        const fileReader = new zip.BlobReader( file.instance )//new FileReader()

        fileReader.onload = function() {

            // do something on FileReader onload
            console.log('File Read')

            file.statusMessage = '📖 Reading file'
        }

        fileReader.onerror = error => {

            // do something on FileReader onload
            console.error('File Read Error', error)

            throw new Error('File Read Error', error)
        }

        fileReader.onprogress = (data) => {
            if (data.lengthComputable) {
                const progress = parseInt( ((data.loaded / data.total) * 100), 10 );
                console.log('Read progress', progress)

                file.statusMessage = `📖 Reading file. ${ progress }% read`
            }
        }

        // console.log('fileReader', fileReader)

        // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-reading
        const zipReader = new zip.ZipReader( fileReader )

        // zipReader.onprogress = console.log

        // zipReader.onerror = console.log

        const entries = await zipReader.getEntries()
            .then( entries => entries.map( entry => {
                return entry

                // return {
                //     filename: entry.filename,
                //     directory: entry.directory
                // }
            }) )
            .catch( error => {
                // console.warn('Unzip Error', error)

                return error
            })

        // console.log('entries', entries)

        if ( !Array.isArray(entries) ) {
            file.statusMessage = '🚫 Could not decompress file'
            file.status = 'finished'

            throw new Error('Could not decompress file')

            // return new Error('Could not decompress file')
        }

        return entries
    }

    findMachOEntries ( entries ) {

        // Create a new set to store and search App Names
        const appNamesInArchive = new Set()

        entries.forEach( entry => {
            // Look through filename parts
            entry.filename.split('/').forEach( filenamePart => {
                if ( filenamePart.includes('.app') ) {
                    const appName = filenamePart.split('.')[0]

                    appNamesInArchive.add( appName )
                }
            } )
        } )

        // Return any entries that match Mach-o file paths
        return entries.filter( entry => {
            let matchesMachOPath = false

            // Match possible Mach-o names against this entries' filename
            appNamesInArchive.forEach( appName => {
                const possibleMachOPath = `${ appName }.app/Contents/MacOS/${ appName }`

                // Check if this possible Mach-o path is contained within this entry's filename
                if ( entry.filename.includes( possibleMachOPath ) ) {
                    matchesMachOPath = true
                }
            })

            return matchesMachOPath
        })

    }

    parseMachOFile () {

    }

    classifyArchitecture () {

    }

    submitScanInfo () {
        // Each file scanned: Filename, Type(Drop or URL), File URL, Datetime, Architectures, Mach-o Meta
    }

    async scan ( fileList ) {

        // console.log('this.files', this.files)

        // Push files to our files array
        Array.from(fileList).forEach( (fileInstance, index) => {
            this.files.unshift( {
                status: 'loaded',
                statusMessage: '⏳ File Loaded and Queud',
                name: fileInstance.name,
                size: fileInstance.size,
                type: fileList.item( index ).type,
                lastModifiedDate: fileInstance.lastModifiedDate,
                instance: fileInstance,
                item: fileList.item( index )
            } )
        })


        // Scan for archives
        await Promise.all( this.files.map( async (file, index) => {

            if ( !this.isApp( file ) ) {
                file.statusMessage = '⏭ Skipped. Not app or archive'
                file.status = 'finished'

                return
            }

            // console.log('file', file)

            // await new Promise(r => setTimeout(r, 1000 * index))

            file.statusMessage = '🗃 Decompressing file'

            let entries

            try {
                entries = await this.unzipFile( file )
            } catch ( Error ) {
                // console.warn( Error )

                // Set status message as error
                file.statusMessage = `🚫 ${ Error.message }`
                file.status = 'finished'

                return
            }

            file.statusMessage = '👀 Scanning App Files'

            file.machOEntries = this.findMachOEntries( entries )

            if ( file.machOEntries.length === 0 ) {
                console.log('entries', entries)

                file.statusMessage = `🚫 Could not find any application data`
                file.status = 'finished'

                return
            }

            // const machOContents = await file.machOFile.getData(
            //     // writer
            //     // https://gildas-lormeau.github.io/zip.js/core-api.html#zip-writing
            //     new zip.TextWriter(),
            //     // options
            //     {
            //         onprogress: (index, max) => {
            //             // onprogress callback
            //             console.log('Writer progress', index, max)
            //         }
            //     }
            // )

            // text contains the entry data as a String
            // console.log('Mach-O contents', machOContents)

            file.statusMessage = `🏁 Scan Finished. ${file.machOEntries.length} Mach-o files`

            file.status = 'finished'

            return
        }))


        // Go through and set all files to finished to clean up any straglers
        this.files.forEach( file => {
            file.status = 'finished'
        })


        return
    }

}
