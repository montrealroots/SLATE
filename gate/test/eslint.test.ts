import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { afterAll, describe, it } from 'vitest';
import slate from '../eslint/plugin.js';

Object.assign(RuleTester, { afterAll, describe, it, itOnly: it.only });

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } } });
const rule = (name: keyof typeof slate.rules) => slate.rules[name];
const raw = (text: string) => ({ message: `Player-facing text comes from the text catalog through t(): "${text}".` });
const missing = (what: string) => ({ message: `A control names its feature: data-feature="<registered id>" (${what}).` });
const unmarked = { message: 'A value shown on a page sits inside an element with data-feature="<registered id>".' };

tester.run('no-raw-text', rule('no-raw-text'), {
  valid: [
    'const a = <p>{t("slots.empty.body")}</p>;',
    'const a = <p>  \n  </p>;',
    'const a = <img alt={t("x.y")} />;',
    'const a = <div className="card" data-feature="a.b" />;',
    'const a = <input value={x} title />;',
    'const a = <p data-feature="a.b">{0}</p>;',
    'const a = <p data-feature="a.b">{x.y}</p>;',
    'const a = <div id="x" data-x="text in a non-text attribute" />;',
  ],
  invalid: [
    { code: 'const a = <p>  Nobody here yet.  </p>;', errors: [raw('Nobody here yet.')] },
    { code: 'const a = <p>Nobody here yet, and nobody has been here for a very long time.</p>;', errors: [raw('Nobody here yet, and nobody has been her')] },
    { code: 'const a = <p>{"Nobody"}</p>;', errors: [raw('Nobody')] },
    { code: 'const a = <p>{"A sentence much longer than forty characters, for the cut."}</p>;', errors: [raw('A sentence much longer than forty charac')] },
    { code: 'const a = <p>{`Nobody ${x}`}</p>;', errors: [raw('`…`')] },
    { code: 'const a = <button aria-label="Close" />;', errors: [raw('Close')] },
    { code: 'const a = <button aria-label="A label much longer than forty characters, for the cut." />;', errors: [raw('A label much longer than forty character')] },
    { code: 'const a = <input placeholder={"Start typing"} />;', errors: [raw('Start typing')] },
    { code: 'const a = <input placeholder={`Start ${x}`} />;', errors: [raw('`…`')] },
    { code: 'const a = <img alt="Headshot" title="x" />;', errors: [raw('Headshot'), raw('x')] },
    { code: 'const a = <meter aria-valuetext="half" aria-description="d" />;', errors: [raw('half'), raw('d')] },
    { code: 'const a = <option label="One" />;', errors: [raw('One')] },
  ],
});

tester.run('control-feature', rule('control-feature'), {
  valid: [
    'const a = <button data-feature="slots.start" onClick={go} />;',
    'const a = <button onClick={go} {...rest} data-feature="slots.start" />;',
    'const a = <select data-feature={"background.family-means"} />;',
    'const a = <select data-feature={ \'a.b\' } />;',
    'const a = <div className="x" iconColor="red" {...props} />;',
    'const a = <Button onClick={go} />;',
    'const a = <Foo.Bar onClick={go} />;',
    'const a = <svg:rect onClick={go} data-feature="a.b" />;',
  ],
  invalid: [
    { code: 'const a = <button onClick={go} />;', errors: [missing('<button>')] },
    { code: 'const a = <input />;', errors: [missing('<input>')] },
    { code: 'const a = <select />;', errors: [missing('<select>')] },
    { code: 'const a = <textarea />;', errors: [missing('<textarea>')] },
    { code: 'const a = <a href="#" data-feature="" />;', errors: [missing('<a>')] },
    { code: 'const a = <a href="#" data-feature="  " />;', errors: [missing('<a>')] },
    { code: 'const a = <textarea data-feature={id} />;', errors: [missing('<textarea>')] },
    { code: 'const a = <textarea data-feature={`a.b`} />;', errors: [missing('<textarea>')] },
    { code: 'const a = <div onClick={go} />;', errors: [missing('<div>')] },
    { code: 'const a = <div className="x" onClick={go} />;', errors: [missing('<div>')] },
    { code: 'const a = <select data-feature />;', errors: [missing('<select>')] },
    { code: 'const a = <select data-feature={3} />;', errors: [missing('<select>')] },
    { code: 'const a = <select data-feature=<b /> />;', errors: [missing('<select>')] },
    { code: 'const a = <button data-feature-x="a.b" />;', errors: [missing('<button>')] },
  ],
});

tester.run('shown-value-feature', rule('shown-value-feature'), {
  valid: [
    'const a = <p data-feature="home.weather">{weather.high}</p>;',
    'const a = <section data-feature="home.weather"><p><b>{weather.high}</b></p></section>;',
    'const a = <section data-feature="home.weather"><><b>{weather.high}</b></></section>;',
    'const a = <p>{t("home.greeting")}</p>;',
    'const a = <ul>{items.map((i) => <li key={i} />)}</ul>;',
    'const a = <div>{open && <Panel />}</div>;',
    'const a = <div>{open ? <A /> : null}</div>;',
    'const a = <div>{open ? <></> : <B />}</div>;',
    'const a = <div>{/* a note */}</div>;',
    'const a = <div>{children}</div>;',
    'const a = <div>{undefined}</div>;',
    'const a = <div className={cls} title={label} />;',
    'const a = <div data-feature="a.b">{c ? <p>{v}</p> : null}</div>;',
    'const a = <div data-feature="a.b">{items.map((i) => <p key={i}>{i.name}</p>)}</div>;',
  ],
  invalid: [
    { code: 'const a = <p>{weather.high}</p>;', errors: [unmarked] },
    { code: 'const a = <p data-feature="">{x}</p>;', errors: [unmarked] },
    { code: 'const a = <div>{open ? <A /> : name}</div>;', errors: [unmarked] },
    { code: 'const a = <div>{open ? name : <A />}</div>;', errors: [unmarked] },
    { code: 'const a = <div>{open && name}</div>;', errors: [unmarked] },
    { code: 'const a = <><b>{money(x)}</b></>;', errors: [unmarked] },
    { code: 'const a = <>{format.money(x)}</>;', errors: [unmarked] },
    { code: 'const a = <p>{0}</p>;', errors: [unmarked] },
    { code: 'const a = <p>{"x"}</p>;', errors: [unmarked] },
    { code: 'const a = <p>{other}</p>;', errors: [unmarked] },
    { code: 'const a = <p data-x="a.b">{x}</p>;', errors: [unmarked] },
    { code: 'const a = <div>{c ? <p>{v}</p> : null}</div>;', errors: [unmarked] },
    { code: 'const f = () => <p>{v}</p>;', errors: [unmarked] },
  ],
});
