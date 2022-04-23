import { unreachable } from "../src/utils";

test("unreachable should throw", () => {
  const spy: jest.SpyInstance = jest.spyOn(console, "warn");
  spy.mockImplementation((...msg: any[]) => {});
  expect(() => unreachable("this should throw")).toThrow("Unreachable");
  expect(spy).toHaveBeenCalled();
});
