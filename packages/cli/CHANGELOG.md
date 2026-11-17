# @rhfan2019/smart-kit-cli

## 0.3.0

### Minor Changes

- 42ec477: smart-kit-server: `$filter` supports the lambda operators `any` / `all` over collection navigations (with `$it` and nested variables), and a data scope may use them (`_ScopeKeys/any(k: k/CompanyCode eq '1000')`); the scope applies to reads, `$count`, key reads, `$expand`, navigation paths and lambdas of other sets, `$apply` and writes (TECH-054). Navigation joins can come from the storage mapping (`entitySets.<Set>.navigations.<name>.on`). New `createKysely(pool, { statementTimeout, keepSettings })` builds Kysely on the host's `pg` pool with UTC sessions and a statement timeout (TECH-066). smart-kit-cli: navigations without a foreign key (views) can be declared in `smart-kit.config.json` (`navigations.<name>` with `from`, `to`, `on`, `toMany` or `toOne`, `partner`); they are generated into the CSDL and the storage mapping, and `smart-kit check` reports declarations whose tables, views or columns do not exist (TECH-055); `checkDeclaredNavigations` exported.

## 0.2.0

No changes in this release.
