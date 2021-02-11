import React, { useMemo } from 'react'
import { StatusBarItemWithKey } from '../../../../shared/src/api/client/api/codeEditor'
import { AbsoluteRepoFile } from '../../../../shared/src/util/url'
import { useObservable } from '../../../../shared/src/util/useObservable'
import classNames from 'classnames'
import { TextDocumentIdentifier } from '../../../../shared/src/api/client/types/textDocument'
import { Observable } from 'rxjs'
import { useCarousel } from '../../components/useCarousel'

interface StatusBarProps extends Omit<AbsoluteRepoFile, 'revision'> {
    getStatusBarItems: (parameters: TextDocumentIdentifier) => Observable<StatusBarItemWithKey[] | null>
}

export const StatusBar: React.FunctionComponent<StatusBarProps> = ({
    getStatusBarItems,
    repoName,
    filePath,
    commitID,
}) => {
    const statusBarItems = useObservable(
        useMemo(
            () =>
                getStatusBarItems({
                    uri: `git://${repoName}?${commitID}#${filePath}`,
                }),
            [getStatusBarItems, repoName, commitID, filePath]
        )
    )

    const carouselState = useCarousel({ direction: 'leftToRight' })
    console.log({ carouselState })
    window.carouselState = carouselState

    // TODO(tj): Wait 5 seconds to show "no information from extensions avaiable"
    // to avoid UI jitter during initial extension activation

    return (
        <div className="status-bar w-100 border-top px-2 d-flex" ref={carouselState.carouselReference}>
            {statusBarItems ? (
                statusBarItems.map(statusBarItem => (
                    <StatusBarItem key={statusBarItem.key} statusBarItem={statusBarItem} />
                ))
            ) : (
                <StatusBarItem
                    key="none-found"
                    statusBarItem={{ key: 'none-found', text: 'No information from extensions available' }}
                />
            )}
        </div>
    )
}

const StatusBarItem: React.FunctionComponent<{ statusBarItem: StatusBarItemWithKey; className?: string }> = ({
    statusBarItem,
    className = 'status-bar',
}) => (
    // TODO(tj): handle command

    <div
        className={classNames(
            `${className}__item h-100 d-flex align-items-center px-1`,
            statusBarItem.tooltip && `${className}__item--tooltipped`
        )}
        data-tooltip={statusBarItem.tooltip}
    >
        <small className={`${className}__text`}>{statusBarItem.text}</small>
    </div>
)
