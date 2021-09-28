process.env.DEBUG = 'bulk_enrich:trace';
const { BulkEnricher } = require('./dist/bulk');

const config = {
  API_KEY: process.env.API_KEY,
  inputFile: process.env.INPUT_FILE
}
const enricher = new BulkEnricher(config);

enricher.start()
.then(() => {
  console.log('Processing Complete!')
})
.catch(err => {
  console.error('Processing Error: ', err);
})