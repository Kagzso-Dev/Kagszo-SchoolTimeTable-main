const XLSX = require('xlsx');
const wb = XLSX.readFile('config/config.xlsx');
const admins = XLSX.utils.sheet_to_json(wb.Sheets['AdminConfig'] || []);
console.log(admins);
