module.exports = {
    port: 3003,
    files: ['./**/*.{html,css,js}'],
    server: {
        baseDir: './',
        // index: '/gsAIViewer-DZI.html',
        middleware: {
            // overrides the second middleware default with new settings
            1: require('connect-history-api-fallback')({
                index: '/gsAIViewer-DZI.html',
                verbose: false,
                htmlAcceptHeaders: ['text/html', 'application/xhtml+xml'] // systemjs workaround
            })
        },
    },
};
