# es6pledges

Releasable Promises for Javascript ES6


(also known as "cancellable promises")

## USAGE

Pledges can be used just like Promises, with the addition of 
the ability to release the pledge from it's obligation, via 
`resolve()`, `reject()` or `release()`. 

Releasing a pledge results in the execution of a release function 
that can terminate the work, and settle the underlying Promise.

In the even that the release function cannot terminate the work,
it can optionally cancel the release and leave all of the pending
`await`, `then()`, `catch()` handlers in place.

```javascript
// a cancellable delay function
function pledgeDelay( delay ){
	let timeout;
	return new Pledge(
		// this is the normal promise function
		( resolve, reject ) => {
			timeout = setTimeout( resolve, delay );
		},
		// this is a release/cancellation function
		() => {
			clearTimeout(timeout);
		}
	);
}

const pledge = pledgeDelay( 1000000 )
	.then( value => console.log( "resolved:", value ))
	.catch( reason => console.log("rejected:", reason ));
	
pledge.reject( "I don't want to wait that long" );

// output 
//
// rejected: I don't want to wait that long
```

## A subtle point

When a chain of pledges is released, ALL of the .then() clauses in 
the chain also get released.

Notice in the example above we rejected the pledge, the .catch() ran.

This also works in general, where then() causes are all resolved.

Here's another example:


```javascript

const pledge = (
	pledgeDelay( 1000000 )
	.then( () => pledgeDelay( 1000000 ))
	.then( value => console.log( 
		"You will see this, because it is called immediately when we", value
	))
);

pledge.resolve( "release the entire pledge chain" );


// output 
//
// You will see this, because it is called immediately when we release 
// the entire pledge chain

```	

## API

### new Pledge()
* `new Pledge ( pledgeFunction, releaseFunction )`

Creates a new Pledge object that will settle at the completion of the `pledgeFunction` or 
when cancelled via the `releaseFunction`


_**pledgeFunction**_
> a function of the form `( resolve, reject ) => {...}` that does some
> work, and then eventually calls either `resolve()` or `reject()`

_**releaseFunction**_
> a function of the form `( resolve, reject, status, reason, ...extras )` 
> that is triggered if the Pledge is released. It should terminate
> any ongoign work being done by the `pledgeFunction`. 
>
> The arguments `status, reason, ...extra` are received from the call to
> `pledge.release()` and can be used by `releaseFunction` to determine 
> how to settle the pledge.
> 
> if `releaseFunction` does not does not settle the pledge by calling either
> `resolve()` or `reject()`, and `releaseFunction` returns `true`, then 
> the release of the pledge is cancelled. 
> 
> If no `releaseFunction` is provided, or if `releaseFunction` does
> not settle the pledge and does not cancel the release of the pledge,
> then the pledge is settled via default behavior. Which is `resolve(
> reason )` is called if `status` is true, and `reject( reason )` is
> called otherwise.


### Pledge.prototype.release()
* `pledge.release( status, reason, ...extras )`

 Releases a pledge from its commitment early, resulting in the
 execution of the `releaseFunction` provided at the creation of the
 Pledge.

_**status, reason, ...extra**_
> The arguments `status, reason, ...extra` are passed to `releaseFunction
> to determine how to settle the pledge.
>
> If no `releaseFunction` is provided, or if `releaseFunction` does
> not settle the pledge and does not cancel the release of the pledge,
> then the pledge is settled via default behavior. Which is `resolve(
> reason )` is called if `status` is true, and `reject( reason )` is
> called otherwise.

> Returns true if the pledge is settled, or false if the release was cancelled
> by the `releaseFunction`

### Pledge.prototype.resolve()
### Pledge.prototype.fulfill()
* `pledge.resolve( reason, ...extras )`
* `pledge.fulfill( reason, ...extras )`

shorthand for `pledge.release( true, reason, ...extras )`

> NOTE the member function `Pledge.prototype.resolve()` is different 
> the class static function `Pledge.resolve()`. The member function causes the
> early release of the Pledge, whereas static function returns an already 
> resolved Pledge object


### Pledge.prototype.reject()
* `pledge.reject( reason, ...extras )`

shorthand for `pledge.release( false, reason, ...extras )`

> NOTE the member function `Pledge.prototype.reject()` is different 
> the class static function `Pledge.reject()`. The member function causes the
> early release of the Pledge, whereas static function returns an already 
> rejected Pledge object


### Pledge.prototype.catch()
### Pledge.prototype.finally()
### Pledge.prototype.then()
### Pledge.all()
### Pledge.allSettled()
### Pledge.any()
### Pledge.race()
### Pledge.reject()
### Pledge.resolve()

These are identical to the `Promises` equivalent





	




	
