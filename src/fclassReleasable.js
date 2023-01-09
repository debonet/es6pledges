module.exports = ( classPromise ) => {
	const Releasable = class extends classPromise {
		#aSettled;
		#fOnRelease;
		#fDoRelease;

		// ---------------------------------------------------
		constructor( f, fOnRelease ){
			let fResolve, fReject;
			const aSettled = {};

			super(( fResolveIn, fRejectIn, ...vx ) => {
				fResolve = ( x ) => {
					if (! aSettled.status ){
						Object.assign( aSettled, { status: 'fulfilled', value: x });
						return fResolveIn( x );
					}
				};
				fReject = ( x ) => {
					if (! aSettled.status ){
						Object.assign( aSettled, { status: 'rejected', reason: x });
						fRejectIn( x );
					}
				};

				f( fResolve, fReject, ...vx );
			});

			this.#aSettled = aSettled;
			this.#fOnRelease = fOnRelease;

			// set up the fDoRelease function that handles the releasing
			// machinery
			this.#fDoRelease = ( bResolve, xStatus, ...vx ) => {
				if ( this.#aSettled.status ){
					return true;
				}

				const fbAutoSettle = ( bCancel ) => {
					if ( bCancel ){
						return this.#aSettled.status ? true : false;
					}
					if ( !this.#aSettled.status ){
						if ( bResolve ){
							fResolve( xStatus );
						}
						else {
							fReject( xStatus );
						}
					}
					return true;
				}

				if ( this.#fOnRelease ){
					let xCancel = this.#fOnRelease(
						fResolve, fReject, bResolve, xStatus, ...vx
					);

					if ( xCancel instanceof Promise ){
						return xCancel.then( fbAutoSettle );
					}
					else {
						return Promise.resolve( fbAutoSettle( xCancel ));
					}
				}
				return Promise.resolve( fbAutoSettle( false ));
			};

			// map the release() to DoRelease but allow it to be overwritten
			// by .then() which needs to handle chaining
			Object.defineProperty( this, 'release', {
				writable: true,
				value : ( ...vx ) => {
					return this.#fDoRelease( ...vx );
				}
			});
		}
			
		// ---------------------------------------------------
		reject( x, ...vx){
			return this.release( false, x, ...vx );
		}

		// ---------------------------------------------------
		resolve( x, ...vx){
			return this.release( true, x, ...vx );
		}
		fulfill( x, ...vx){
			return this.release( true, x, ...vx );
		}
		
		// ---------------------------------------------------
		then( fThen, fCatch ){
			let bReleased;
			let vxReleaseArgs = [];
			
			const ffWrap = ( f ) => {
				return ( ...vx ) => {
					const pSub = f( ...vx );
					if ( bReleased && pSub?.release ){
						pSub.release( ...vxReleaseArgs );
					}
					return pSub;
				}
			}
			
			const p = super.then(
				fThen ? ffWrap( fThen ) : undefined,
				fCatch ? ffWrap( fCatch ) : undefined
			);

			Object.defineProperty( p, 'release', {
				writable: true,
				value : async ( ...vxReleaseArgsIn ) => {
					vxReleaseArgs = vxReleaseArgsIn;
					// if any child is resolved while the parent is being released
					// assume it is because of the release
					bReleased = true;
					// tell the parent to release
					const bDoRelease = await this.release( ...vxReleaseArgsIn );
					// if the children did not get resolved during the parents release
					// then they should release only if the parent says its ok
					bReleased = bDoRelease;
					return bDoRelease;
				}
			});
			
			return p;
		}

		// ---------------------------------------------------
		static #ffReleaseGroup( vpGroup ){
			return ( ...vx ) => {
				let bAllReleased = true;
				vpGroup.forEach( pGroup => {
					if ( pGroup.release ) {
						bAllReleased = pGroup.release( ...vx ) && bAllReleased;
					}
				});

				return bAllReleased;
			}
		}
		
		// ---------------------------------------------------
		static all( vp, ...vx ){
			const p  = super.all( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}

		// ---------------------------------------------------
		static any( vp, ...vx ){
			const p  = super.any( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}
		
		// ---------------------------------------------------
		static allSettled( vp, ...vx ){
			const p  = super.allSettled( vp, ...vx );

			p.release = Releasable.#ffReleaseGroup( vp );

			const pReleaser = new Releasable(
				() => {},
				( fResolve, fReject, bResolve, x ) => {
					fResolve(	vp.map(( p ) => {
						if ( p.aSettled?.status ){
							return p.aSettled;
						}
						if ( bResolve ){
							return { status: 'released-fulfilled', value: x };
						}

						return { status: 'released-rejected', reason: x }
					}));
				}
			);

			const pRace = super.any([ p, pReleaser ]);
			pRace.release = Releasable.#ffReleaseGroup([ p, pReleaser ]);

			return pRace
		}

		// ---------------------------------------------------
		static race( vpIn, ...vx ){
			const vp = [ ...vpIn, new Releasable(()=>{}) ];
			const p  = super.race( vp, ...vx );
			p.release = Releasable.#ffReleaseGroup( vp );
			return p;
		}


		// ---------------------------------------------------
		static detachable( p ){
			return new Releasable( ( fOk, fErr ) =>{
				p.then( fOk, fErr );
			});
		}
		
	};

	return Releasable;
}
