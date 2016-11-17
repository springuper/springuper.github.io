var condition = Math.random() > 0.5;
if (condition) {
  var math = require('./math');

  console.log(math.add(1, 2));
  console.log(math.minus(2, 1));
}
