import { Token, TokenType } from "../src/tokens";

test("toString() should fully represent token", () => {
  const token: Token = new Token("fish", TokenType.TokenName, 1, 1);
  expect(token.toString()).toBe(
    `Token(type=TOKEN_NAME, value='fish', line=1, col=1, msg='')`
  );
  token.msg = "no errors";
  expect(token.toString()).toBe(
    `Token(type=TOKEN_NAME, value='fish', line=1, col=1, msg='no errors')`
  );
});
