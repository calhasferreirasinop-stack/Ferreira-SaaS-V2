import bcrypt from 'bcryptjs';
const hash = '$2b$10$d/25pwAqjsMkuLrZiZjfFunt/i1in2F7j5katLQwnUFNKjomejjEC';
const password = 'admin123';
console.log('Testing admin123:', bcrypt.compareSync(password, hash));
console.log('Testing 123:', bcrypt.compareSync('123', hash));
