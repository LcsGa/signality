import {
  inject,
  linkedSignal,
  type CreateSignalOptions,
  type Signal,
  type WritableSignal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, type NavigationExtras, type Params } from '@angular/router';
import { proxySignal, setupContext } from '@signality/core/internal';
import type { WithInjector } from '@signality/core/types';

export type QueryParamsOptions<T extends Params = Params> = CreateSignalOptions<T> &
  WithInjector &
  Pick<NavigationExtras, 'replaceUrl'>;

/**
 * Reactive wrapper around the [Angular Router](https://angular.dev/guide/routing) query parameters.
 *
 * @param options - Optional configuration including signal options and injector
 * @returns A signal containing the current query parameters
 *
 * @example
 * ```typescript
 * @Component({
 *   template: `
 *     <div>
 *       <p>Search: {{ searchParams().q }}</p>
 *       <p>Sort: {{ searchParams().sort }}</p>
 *     </div>
 *   `
 * })
 * export class SearchParamsDemo {
 *   // Route: /search?q=angular&sort=name
 *   readonly searchParams = queryParams<{ q: string; sort: string }>();
 * }
 * ```
 */
export function queryParams<T extends Params = Params>(
  options?: QueryParamsOptions<T>
): WritableSignal<T> {
  const { runInContext } = setupContext(options?.injector, queryParams);

  return runInContext(() => {
    const router = inject(Router);
    const { queryParams: paramsChanges, snapshot } = inject(ActivatedRoute);

    const queryParams = linkedSignal(
      toSignal(paramsChanges, { initialValue: snapshot.queryParams }) as Signal<T>
    );

    return proxySignal(queryParams, {
      set: async (value, source) => {
        const succeeded = await router.navigate([], {
          queryParams: value,
          queryParamsHandling: 'merge',
          preserveFragment: true,
          replaceUrl: options?.replaceUrl,
        });
        if (!succeeded) source.set(value);
      },
    });
  });
}
