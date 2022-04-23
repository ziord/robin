### Welcome

Hi, and welcome to the contribution guideline page. Thanks for taking the effort to get here. Consider taking a look at the [project architecture](https://github.com/ziord/robin/blob/master/ARCHITECTURE.md) if you haven't already.
Below are the steps that needs to be followed in order to contribute to this project.

### Fork the Project

You can follow [this guideline](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo) to fork the project.


### Add the Feature

Add the feature you'd like to contribute to the project Please keep commits cohesive, and simple enough to describe the changes being added.


### Add a Test

Please add a test for the newly added feature.
For instance if you add a feature **A** in `src/dom.ts` file, then you should add a test in `tests/dom.test.ts` file. That is, the test(s) should be added to the source file corresponding to the file that the feature was added.
Also, run the tests using `npm test` to ensure that the test passes, and older tests are not broken. Testing is done using the [Jest](https://jestjs.io/) testing framework.



### Open a Pull Request

Create a pull request for the change added. [This guideline](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/creating-a-pull-request) details how to do so.
Ensure to add a title that states the specific purpose of the pull request. For bug fixes, in the description, ensure to add a break down of the problem, reproducibility, and how your pull request fixes the problem. For feature additions, ensure to add a break down of the feature, including its purpose/motivation/reason.


### Code Style

Please embrace simplicity over tricky, complicated approach of solving a problem. Adding comments to sections that wouldn't be immediately understood is highly recommended, and encouraged. Simply running `npm test` after your changes informs you if your code conforms to the style expected.
If [Prettier](https://prettier.io/) complains about the code format, try reformatting using `npm run format`.
