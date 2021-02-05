import { ProxyMarked, proxyMarker } from 'comlink'
import { TextDocumentDecoration } from '@sourcegraph/extension-api-types'
import { flatten, values } from 'lodash'
import { BehaviorSubject, Observable, Subscription } from 'rxjs'
import { ProvideTextDocumentDecorationSignature } from '../services/decoration'
import { FeatureProviderRegistry } from '../services/registry'
import { TextDocumentIdentifier } from '../types/textDocument'
import { StatusBarItem, StatusBarItemType } from 'sourcegraph'
import { ProvideStatusBarItemsSignature } from '../services/statusBar'

/** @internal */
export interface ClientCodeEditorAPI extends ProxyMarked {
    $setDecorations(resource: string, decorationType: string, decorations: TextDocumentDecoration[]): void
    $setStatusBarItem(resource: string, statusBarItem: StatusBarItemWithKey): void
}

interface PreviousDecorations {
    [resource: string]: {
        [decorationType: string]: TextDocumentDecoration[]
    }
}

interface PreviousStatusBarItems {
    [resource: string]: {
        [decorationType: string]: StatusBarItemWithKey
    }
}
export type StatusBarItemWithKey = StatusBarItem & StatusBarItemType

/** @internal */
export class ClientCodeEditor implements ClientCodeEditorAPI {
    public readonly [proxyMarker] = true

    private subscriptions = new Subscription()

    /** Map of document URI to its decorations (last published by the server). */
    private decorations = new Map<string, BehaviorSubject<TextDocumentDecoration[]>>()

    private previousDecorations: PreviousDecorations = {}

    /** Map of document URI to its status bar items (last published by the server). */
    private statusBarItems = new Map<string, BehaviorSubject<StatusBarItemWithKey[]>>()

    private previousStatusBarItems: PreviousStatusBarItems = {}

    constructor(
        private decorationRegistry: FeatureProviderRegistry<undefined, ProvideTextDocumentDecorationSignature>,
        private statusBarRegistry: FeatureProviderRegistry<undefined, ProvideStatusBarItemsSignature>
    ) {
        this.subscriptions.add(
            this.decorationRegistry.registerProvider(
                undefined,
                (textDocument: TextDocumentIdentifier): Observable<TextDocumentDecoration[]> =>
                    this.getDecorationsSubject(textDocument.uri)
            )
        )

        this.subscriptions.add(
            this.statusBarRegistry.registerProvider(
                undefined,
                (textDocument: TextDocumentIdentifier): Observable<StatusBarItemWithKey[]> =>
                    this.getStatusBarItemsSubject(textDocument.uri)
            )
        )
    }

    public $setDecorations(resource: string, decorationType: string, decorations: TextDocumentDecoration[]): void {
        // eslint-disable-next-line rxjs/no-ignored-observable
        this.getDecorationsSubject(resource, decorationType, decorations)
    }

    public $setStatusBarItem(resource: string, statusBarItem: StatusBarItemWithKey): void {
        // eslint-disable-next-line rxjs/no-ignored-observable
        this.getStatusBarItemsSubject(resource, statusBarItem)
    }

    private getDecorationsSubject(
        resource: string,
        decorationType?: string,
        decorations?: TextDocumentDecoration[]
    ): BehaviorSubject<TextDocumentDecoration[]> {
        let subject = this.decorations.get(resource)
        if (!subject) {
            subject = new BehaviorSubject<TextDocumentDecoration[]>(decorations || [])
            this.decorations.set(resource, subject)
            this.previousDecorations[resource] = {}
        }
        if (decorations !== undefined) {
            // Replace previous decorations for this resource + decorationType
            this.previousDecorations[resource][decorationType!] = decorations

            // Merge decorations for all types for this resource, and emit them
            const nextDecorations = flatten(values(this.previousDecorations[resource]))
            subject.next(nextDecorations)
        }
        return subject
    }

    private getStatusBarItemsSubject(
        resource: string,
        statusBarItem?: StatusBarItemWithKey
    ): BehaviorSubject<StatusBarItemWithKey[]> {
        let subject = this.statusBarItems.get(resource)
        if (!subject) {
            subject = new BehaviorSubject<StatusBarItemWithKey[]>(statusBarItem ? [statusBarItem] : [])
            this.statusBarItems.set(resource, subject)
            this.previousStatusBarItems[resource] = {}
        }
        if (statusBarItem !== undefined) {
            // Replace previous status bar item for this resource + statusBarItemType
            this.previousStatusBarItems[resource][statusBarItem.key] = statusBarItem

            // Emit all status bar items for this resource
            const nextStatusBarItems = Object.values(this.previousStatusBarItems[resource])
            subject.next(nextStatusBarItems)
        }
        return subject
    }

    public unsubscribe(): void {
        // Clear decorations.
        for (const subject of this.decorations.values()) {
            subject.next([])
        }

        this.subscriptions.unsubscribe()
    }
}
