import { TextDocumentIdentifier } from '../types/textDocument'
import { FeatureProviderRegistry } from './registry'
import { StatusBarItem } from 'sourcegraph'
import { Observable } from 'rxjs'
import { map, switchMap } from 'rxjs/operators'
import { combineLatestOrDefault } from '../../../util/rxjs/combineLatestOrDefault'
import { flattenAndCompact } from './util'

export type ProvideStatusBarItemsSignature = (
    textDocument: TextDocumentIdentifier
) => Observable<StatusBarItem[] | null>

/** Provides status bar items from all extensions. */
export class StatusBarItemProviderRegistry extends FeatureProviderRegistry<undefined, ProvideStatusBarItemsSignature> {
    public getStatusBarItems(parameters: TextDocumentIdentifier): Observable<StatusBarItem[] | null> {
        return getStatusBarItems(this.providers, parameters)
    }
}

/**
 * Returns an observable that emits all status bar items whenever any of the last-emitted set of providers emits
 * status bar items.
 *
 * Most callers should use StatusBarItemProviderRegistry, which uses the registered status bar item providers.
 */
export function getStatusBarItems(
    providers: Observable<ProvideStatusBarItemsSignature[]>,
    parameters: TextDocumentIdentifier
): Observable<StatusBarItem[] | null> {
    console.log({ providers, parameters })
    return providers
        .pipe(
            switchMap(providers => {
                console.log('provs', providers)
                return combineLatestOrDefault(providers.map(provider => provider(parameters)))
            })
        )
        .pipe(map(flattenAndCompact))
}
