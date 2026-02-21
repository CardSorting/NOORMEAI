// Mock implementation of chalk for Jest tests
const createChainableChalk = () => {
  const identity = (text) => text;

  const handler = {
    get(target, prop) {
      // If it's a known chalk method, return a chainable function
      if (typeof prop === 'string') {
        return createChainableChalk();
      }
      return target[prop];
    },
    apply(target, thisArg, args) {
      // When called as a function, just return the text
      return args[0];
    }
  };

  return new Proxy(identity, handler);
};

const chalk = createChainableChalk();

export default chalk;
