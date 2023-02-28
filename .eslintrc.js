module.exports = {
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: 'google',
    "env": {
        "es6": true,
    },
    "rules": {
        "max-len": [
            "error", { "code": 160, "ignoreStrings": true, "ignoreComments": true }
        ]
    }
}