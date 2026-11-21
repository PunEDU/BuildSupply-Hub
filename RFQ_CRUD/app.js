const path = require('node:path');
const express = require('express');
const { engine } = require('express-handlebars');
const { createPool } = require('./db');
const { createRfqStore } = require('./rfq-store');
const { createRfqRouter } = require('./routes/rfqs');

function createApp(store, buyerId = 1) {
    const app = express();
    app.disable('x-powered-by');
    app.engine('hbs', engine({ extname: '.hbs', helpers: { equal: (left, right) => String(left) === String(right) } }));
    app.set('view engine', 'hbs');
    app.set('views', path.join(__dirname, 'views'));

    app.use((req, res, next) => {
        const host = req.get('host');
        const origin = req.get('origin');
        if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || '') ||
            (req.method === 'POST' && (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== `http://${host}`)))) {
            return res.sendStatus(403);
        }
        next();
    });
    app.use(express.urlencoded({ extended: false, limit: '16kb' }));
    app.use('/assets', express.static(path.join(__dirname, 'public')));
    app.get('/assets/bootstrap.css', (_req, res) => res.sendFile(require.resolve('bootstrap/dist/css/bootstrap.min.css')));
    app.get('/assets/htmx.js', (_req, res) => res.sendFile(path.join(
        path.dirname(require.resolve('htmx.org/package.json')), 'dist', 'htmx.min.js',
    )));
    app.get('/', (_req, res) => res.redirect('/contractor/rfqs'));
    app.use('/contractor/rfqs', createRfqRouter(store, buyerId));
    app.use((_req, res) => res.status(404).render('message', { title: 'Page not found' }));
    app.use((error, _req, res, next) => {
        if (res.headersSent) return next(error);
        if (error.status === 413) return res.status(413).render('message', { title: 'The form is too large' });
        console.error(error.code || error.message);
        res.status(500).render('message', { title: 'Something went wrong', message: 'Check that MySQL is running, then try again.' });
    });
    return app;
}

if (require.main === module) {
    const pool = createPool();
    const port = Number(process.env.PORT || 3104);
    pool.query('SELECT unit_id FROM unit LIMIT 1').then(() => {
        const server = createApp(createRfqStore(pool)).listen(port, '127.0.0.1', () => {
            console.log(`BuildSupply Hub RFQs: http://127.0.0.1:${port}/contractor/rfqs`);
        });
        server.on('error', async error => {
            console.error(error.message);
            await pool.end();
            process.exitCode = 1;
        });
    }).catch(async error => {
        console.error(`Cannot open the Assignment 4 MySQL schema (${error.code || error.message}).`);
        await pool.end();
        process.exitCode = 1;
    });
}

module.exports = { createApp };
