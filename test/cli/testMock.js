const chalk = require('./__mocks__/chalk.js');

console.log('chalk:', typeof chalk);
console.log('chalk.blue:', typeof chalk.blue);
console.log('chalk.blue.bold:', typeof chalk.blue.bold);
console.log('Result:', chalk.blue.bold('test'));
