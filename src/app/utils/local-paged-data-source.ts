import { DataSource } from '@angular/cdk/collections';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { BehaviorSubject, combineLatest, Observable, Subscription, of } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

export interface LocalPagedOptions<T, F = string> {
  sortFn?: (a: T, b: T, active: string, direction: 'asc'|'desc') => number;
  /** Devuelve true si el item pasa el filtro */
  filterFn?: (item: T, filter: F) => boolean;
  initialPageSize?: number;
}

export class LocalPagedDataSource<T extends Record<string, any>, F = string> extends DataSource<T> {
  private data$   = new BehaviorSubject<T[]>([]);
  private filter$ = new BehaviorSubject<F | null>(null);
  private sub     = new Subscription();

  constructor(
    source$: Observable<T[]>,
    private paginator: MatPaginator,
    private sort: MatSort,
    private opts: LocalPagedOptions<T, F> = {}
  ) {
    super();
    if (opts.initialPageSize) this.paginator._changePageSize(opts.initialPageSize);
    this.sub.add(source$.subscribe(arr => this.data$.next(arr ?? [])));
  }

  connect(): Observable<T[]> {
    const sortChange$ = this.sort ? this.sort.sortChange.pipe(startWith({})) : of({});
    const pageChange$ = this.paginator ? this.paginator.page.pipe(startWith({})) : of({});

    return combineLatest([this.data$, this.filter$, sortChange$, pageChange$]).pipe(
      map(([data, filter]) => {
        // 1) filtrar
        const filtered = (filter && this.opts.filterFn)
          ? data.filter(d => this.opts.filterFn!(d, filter))
          : data;

        // 2) ordenar
        const active = this.sort?.active;
        const dir    = (this.sort?.direction || 'asc') as 'asc'|'desc';
        const sorted = active
          ? [...filtered].sort((a, b) =>
              this.opts.sortFn ? this.opts.sortFn(a, b, active!, dir)
                               : defaultSort(a, b, active!, dir))
          : filtered;

        // 3) paginar
        const start = this.paginator.pageIndex * this.paginator.pageSize;
        const end   = start + this.paginator.pageSize;
        this.paginator.length = sorted.length;
        return sorted.slice(start, end);
      })
    );
  }

  disconnect(): void {
    this.sub.unsubscribe();
    this.data$.complete();
    this.filter$.complete();
  }

  /** Establece el filtro estructurado */
  setFilter(filter: F) { this.filter$.next(filter); }

  /** Útil si quieres limpiar el filtro */
  clearFilter() { this.filter$.next(null); }
}

// sort por clave texto/num básico
function defaultSort(a: any, b: any, key: string, dir: 'asc'|'desc') {
  const va = a?.[key];
  const vb = b?.[key];
  let cmp = 0;
  if (typeof va === 'number' && typeof vb === 'number') cmp = va - vb;
  else {
    const sa = (va ?? '').toString().toLowerCase();
    const sb = (vb ?? '').toString().toLowerCase();
    cmp = sa < sb ? -1 : sa > sb ? 1 : 0;
  }
  return dir === 'asc' ? cmp : -cmp;
}
