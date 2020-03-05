const fs = require('fs')
const Handlebars = require('handlebars')
const promisify = require('util').promisify
const stat = promisify(fs.stat)
const readdir = promisify(fs.readdir)
const conf = require('../config/defaultConfig')
const path = require('path')
const tplPath = path.join(__dirname, '../template/dir.tpl')
const source = fs.readFileSync(tplPath)
const template = Handlebars.compile(source.toString())
const mime = require('./mime.js')
const compress = require('./compress')
const range = require('./range')
module.exports = async (req, res, filePath) => {
    try {
        const stats = await stat(filePath)
        if (stats.isFile()) {
            const contentType = mime(filePath)
            res.setHeader('Content-Type', contentType)
            let rs;
            const {
                code,
                start,
                end
            } = range(stats.size, req, res)
            if (code === 200) {
                res.statusCode = 200
                rs = fs.createReadStream(filePath)
            } else {
                res.statusCode = 206
                rs = fs.createReadStream(filePath, {
                    start,
                    end
                })
            }
            if (filePath.match(conf.compress)) {
                rs = compress(rs, req, res)
            }
            rs.pipe(res)
        } else if (stats.isDirectory()) {
            const files = await readdir(filePath)
            res.statusCode = 200
            res.setHeader('Content-Type', 'text/html')
            const dir = path.relative(conf.root, filePath)
            const data = {
                title: path.basename(filePath),
                dir: dir ? `/${dir}` : '',
                files: files.map(file => {
                    return {
                        file,
                        icon: mime(file)
                    }
                })
            }
            res.end(template(data))
        }
    } catch (ex) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain')
        res.end(`${filePath} is not a directory or file\n ${ex.toString()}`)
    }
}