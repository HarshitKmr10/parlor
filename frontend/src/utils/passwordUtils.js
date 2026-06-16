import { passwordRegex } from "./validationUtils";

export const generatePassword = () => {
    const length = 12;
    const uppercaseChars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercaseChars = "abcdefghijklmnopqrstuvwxyz";
    const numberChars = "0123456789";
    const specialChars = "!@#$%?^&*";
    let password = "";

    // Ensure at least one character from each required set
    password += uppercaseChars[Math.floor(Math.random() * uppercaseChars.length)];
    password += lowercaseChars[Math.floor(Math.random() * lowercaseChars.length)];
    password += numberChars[Math.floor(Math.random() * numberChars.length)];
    password += specialChars[Math.floor(Math.random() * specialChars.length)];

    // Fill the rest with a mix of all characters
    const allChars = uppercaseChars + lowercaseChars + numberChars + specialChars;
    for (let i = password.length; i < length; i++) {
        password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Shuffle the password to make it more random
    password = password
        .split('')
        .sort(() => Math.random() - 0.5)
        .join('');

    // Verify password meets requirements
    return  passwordRegex.test(password) ? password : generatePassword();
};