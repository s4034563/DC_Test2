function normalizeWord(word) {
  return word.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

function tokenize(messageContent) {
  return messageContent.split(/\s+/).filter(Boolean);
}

function collectNumbersFromWord(word) {
  return word.match(/\d+/g) ?? [];
}

function collectOperatorFromWord(word) {
  const operators = ['+', '-', '*', '/'];
  const found = operators.filter((operator) => word.includes(operator));
  return found.length === 1 ? found[0] : null;
}

function buildExpressionAndAnswer(bodyWords) {
  const tokens = [];

  for (let index = 0; index < bodyWords.length; index += 1) {
    const position = index + 1;
    const word = bodyWords[index];

    if (position % 3 === 0) {
      const numbers = collectNumbersFromWord(word);
      for (const number of numbers) {
        tokens.push({ type: 'number', value: number });
      }
    }

    if (position % 4 === 0) {
      const operator = collectOperatorFromWord(word);
      if (operator) {
        tokens.push({ type: 'operator', value: operator });
      }
    }
  }

  if (tokens.length === 0) {
    return { expression: null, answer: null };
  }

  const numberTokens = tokens.filter((token) => token.type === 'number');
  if (numberTokens.length === 1) {
    const expression = `${numberTokens[0].value}*42`;
    return { expression, answer: evaluateExpression(expression) };
  }

  const normalizedTokens = [];

  for (const token of tokens) {
    if (token.type === 'number') {
      const previous = normalizedTokens[normalizedTokens.length - 1];
      if (previous?.type === 'number') {
        normalizedTokens.push({ type: 'operator', value: '*' });
      }

      normalizedTokens.push(token);
      continue;
    }

    const previous = normalizedTokens[normalizedTokens.length - 1];
    if (previous?.type === 'operator') {
      return { expression: null, answer: null };
    }

    normalizedTokens.push(token);
  }

  if (normalizedTokens[0]?.type === 'operator' || normalizedTokens.at(-1)?.type === 'operator') {
    return { expression: null, answer: null };
  }

  const expression = normalizedTokens.map((token) => token.value).join('');
  const answer = evaluateExpression(expression);

  return { expression, answer };
}

function evaluateExpression(expression) {
  if (!/^\d+(?:[+\-*/]\d+)*$/.test(expression)) {
    return null;
  }

  const values = [];
  const operators = [];

  const precedence = {
    '+': 1,
    '-': 1,
    '*': 2,
    '/': 2,
  };

  function applyOperator() {
    const operator = operators.pop();
    const right = values.pop();
    const left = values.pop();

    if (left === undefined || right === undefined || operator === undefined) {
      return false;
    }

    switch (operator) {
      case '+':
        values.push(left + right);
        break;
      case '-':
        values.push(left - right);
        break;
      case '*':
        values.push(left * right);
        break;
      case '/':
        values.push(left / right);
        break;
      default:
        return false;
    }

    return true;
  }

  const parts = expression.match(/\d+|[+\-*/]/g) ?? [];
  for (const part of parts) {
    if (/^\d+$/.test(part)) {
      values.push(Number(part));
      continue;
    }

    while (operators.length > 0 && precedence[operators.at(-1)] >= precedence[part]) {
      if (!applyOperator()) {
        return null;
      }
    }

    operators.push(part);
  }

  while (operators.length > 0) {
    if (!applyOperator()) {
      return null;
    }
  }

  return values.length === 1 ? values[0] : null;
}

function buildWordSet(words) {
  const set = new Set();
  for (const word of words) {
    const normalized = normalizeWord(word);
    if (normalized) {
      set.add(normalized);
    }
  }

  return set;
}

function evaluateMessage(messageContent, playerState) {
  const withoutFinalComma = messageContent.replace(/,$/, '').trim();
  const bodyWords = tokenize(withoutFinalComma);
  const violations = [];

  if (withoutFinalComma.length < 4) {
    violations.push({ rule: 8, reason: 'Message must be at least 4 characters long.' });
  }

  if (/[hae]/i.test(withoutFinalComma)) {
    violations.push({ rule: 5, reason: 'Letters h, a, and e are not allowed.' });
  }

  if (/([a-z])\1\1/i.test(withoutFinalComma)) {
    violations.push({ rule: 'Repeated letters', reason: 'No more than 2 identical letters may appear in a row.' });
  }

  if (/\bI\b|\bi\b/.test(withoutFinalComma)) {
    violations.push({ rule: 6, reason: 'Standalone I is not allowed.' });
  }

  if (!messageContent.trim().endsWith(',')) {
    violations.push({ rule: 10, reason: 'Message must end with a comma.' });
  }

  if (bodyWords.length < 4) {
    violations.push({ rule: 8, reason: 'The body of the sentence must contain at least 4 words.' });
  }

  if (bodyWords[1] && bodyWords[1].length % 2 === 0) {
    violations.push({ rule: 1, reason: 'The second word in the body must have an odd number of characters.' });
  }

  if (bodyWords.length > 0 && bodyWords.length < 2) {
    violations.push({ rule: 1, reason: 'The second word in the sentence is missing.' });
  }

  for (let index = 2; index < bodyWords.length; index += 3) {
    if (!/\d/.test(bodyWords[index])) {
      violations.push({ rule: 2, reason: `Word ${index + 1} must include at least one number.` });
    }
  }

  for (let index = 3; index < bodyWords.length; index += 4) {
    const operatorCount = (bodyWords[index].match(/[+\-*/]/g) ?? []).length;
    if (operatorCount !== 1) {
      violations.push({ rule: 3, reason: `Word ${index + 1} must contain exactly one arithmetic operator symbol.` });
    }
  }

  const lastWord = bodyWords.at(-1);
  const answerToken = lastWord?.replace(/,$/, '');
  const { answer } = buildExpressionAndAnswer(bodyWords.slice(0, -1));

  if (answer === null) {
    violations.push({ rule: 4, reason: 'The math expression could not be evaluated.' });
  }

  const expectedAnswer = Number.isInteger(answer) ? String(answer) : String(answer).replace(/\.0+$/, '');
  if (answer !== null && answerToken !== expectedAnswer) {
    violations.push({ rule: 4, reason: `The final answer must be ${expectedAnswer}.` });
  }

  const previousWords = (playerState?.successfulMessages ?? []).flatMap((message) => message.words);
  const currentWords = bodyWords.slice(0, -1);
  const currentWordSet = buildWordSet(currentWords);
  const overlap = [...buildWordSet(previousWords)].filter((word) => currentWordSet.has(word)).length;
  if (overlap > 3) {
    violations.push({ rule: 9, reason: 'Too many words overlap with your last two successful messages.' });
  }

  if (violations.length > 0) {
    return { allowed: false, violations };
  }

  return {
    allowed: true,
    normalizedWords: currentWords.map(normalizeWord).filter(Boolean),
  };
}

module.exports = {
  evaluateMessage,
  buildExpressionAndAnswer,
  normalizeWord,
};