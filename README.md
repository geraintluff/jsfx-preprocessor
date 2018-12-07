# JSFX Pre-Processor

This is a pre-processor for REAPER's JSFX language, that makes it easier to manage structured data and large code-bases.

It adds two types of syntax: automatic enums and switchable functions.

## Usage

```javascript
var pp = require('jsfx-preprocessor'); // function

var code = fs.readFileSync(inputFile, {encoding: 'utf-8'});
fs.writeFileSync(outputFile, pp(code));
```

## Automatic enums

This is designed to help you use structured data within the memory block/array.  A group identifier can be composed of letters, numbers, and `_`, followed by the hash symbol `#`.

Given a group, e.g. `FOO#`, each suffix (e.g. `FOO#bar`) is given a unique index, counting from zero.  The plain expression (e.g. just `FOO#` without a suffix) is replaced by the number of suffices there are defined by that group.

### Example

Input:

```
pointer = mylist_start; // Array of MYSTRUCTs
while (pointer < mylist_end) (
	pointer[MYSTRUCT#FOO] = "foo";
	pointer[MYSTRUCT#BAR] = 5;
	pointer += MYSTRUCT#; // Struct length
);
```

Output:

```
pointer = mylist_start; // Array of MYSTRUCTs
while (pointer < mylist_end) (
	pointer[0] = "foo";
	pointer[1] = 5;
	pointer += 2;
);
```

### Forcing

To force an enum to have a particular value, you can include a number in brackets after it, e.g. `FOO#bar(5)`.  If there is a conflict in these, the pre-processor throws an error.

### Counting

If a group is not counted (e.g. `FOO#`) at any point in the code, then a warning is produced.

## Switchable functions

The JSFX language has no function pointers, but sometimes you want a different function to be called depending on a field in your struct.  In that case, you can create a "switchable function group", which generates a function that checks the value and then relays to other functions.

### Example

Input:

```
pointer[MYSTRUCT#INIT_FUNC] = {init_func}some_init; // Create reference to function
function some_init(x, y) (
	// Perform some init
);

// Group declaration - placed below all references
function {init_func}(x, y);

// Call a function pointer
{init_func:pointer[MYSTRUCT#INIT_FUNC]}(1, 2);
```

Output:

```
pointer[0] = 1; // Create reference to function
function some_init(x, y) (
        // Perform some init
);

// Group declaration - placed below all references
function init_func(function_id, x, y) (
        function_id ? (
                function_id == 1 ? some_init(x, y)
        );
);;

// Call a function pointer
init_func(pointer[0], 1, 2);
```

## Sequence templates

Unrolling loops produces a lot of almost-duplicated code, so we have a syntax for numeric sequences.

Sequences are opened with `{#var=start,end}` and closed with `{#}`.  `start` and `end` are integers.  The limits are inclusive, and can be reversed to get a backwards-counting sequence.

### Example

Input:

```
{#FOO=1,10}
varFOO += FOO;
{#}
```

Output:

```
var1 += 1;
var2 += 2;
var3 += 3;
var4 += 4;
var5 += 5;
var6 += 6;
var7 += 7;
var8 += 8;
var9 += 9;
var10 += 10;
```
