const f = () => {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      resolve(123);
    }, 2000);
  });
};

module.exports = async () => {
  const t = await f();
  console.log(t);
};
