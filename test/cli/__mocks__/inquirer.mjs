// Mock implementation of inquirer for Jest tests
const inquirer = {
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
};

export default inquirer;
