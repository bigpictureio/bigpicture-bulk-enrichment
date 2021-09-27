process.env.DEBUG = 'bulk_enrich:trace';
const { BulkEnricher } = require('./dist/bulk');

const config = {
  API_KEY: process.env.API_KEY,

  // add input / output file names here
  inputFile: "test-input.csv",
  outputFile: "test-output.csv"
}
const enricher = new BulkEnricher(config);

enricher.start()
.then(() => {
  console.log('Processing Complete!')
})
.catch(err => {
  console.error('Processing Error: ', err);
})