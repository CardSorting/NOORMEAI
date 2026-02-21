// Jest setup file that runs before tests
// This is used to set up mocks that need to be hoisted

// Create chainable chalk mock
const createChainableChalk = () => {
  const identity = (text) => text;
  const handler = {
    get(target, prop) {
      if (typeof prop === 'string') {
        return createChainableChalk();
      }
      return target[prop];
    },
    apply(target, thisArg, args) {
      return args[0];
    }
  };
  return new Proxy(identity, handler);
};

// Mock chalk before any imports
jest.mock('chalk', () => ({
  __esModule: true,
  default: createChainableChalk()
}));

// Mock inquirer before any imports
jest.mock('inquirer', () => ({
  __esModule: true,
  default: {
    prompt: async (questions) => {
      const answers = {};
      if (Array.isArray(questions)) {
        questions.forEach((q) => {
          if (q.type === 'confirm') {
            answers[q.name] = true;
          } else if (q.type === 'list') {
            answers[q.name] = q.choices?.[0]?.value || q.choices?.[0];
          } else if (q.type === 'input') {
            answers[q.name] = q.default || '';
          } else if (q.type === 'checkbox') {
            answers[q.name] = [];
          } else {
            answers[q.name] = q.default || '';
          }
        });
      }
      return answers;
    }
  }
}));
