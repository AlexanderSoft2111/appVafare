import { DataSource } from '@angular/cdk/collections';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { BehaviorSubject, combineLatest, Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

export interface LocalPagedOptions<T> {
  sortFn?: (a: T, b: T, active: string, direction: 'asc'|'desc') => number;
  filterFn?: (item: T, term: string) => boolean;
  initialPageSize?: number;
}

export class LocalPagedDataSource<T extends Record<string, any>> extends DataSource<T> {
  private data$ = new BehaviorSubject<T[]>([]);
  private filter$ = new BehaviorSubject<string>('');
  private sub = new Subscription();

  constructor(
    source$: Observable<T[]>,
    private paginator: MatPaginator,
    private sort: MatSort,
    private opts: LocalPagedOptions<T> = {}
  ) {
    super();

    // page size inicial (opcional)
    if (opts.initialPageSize) this.paginator._changePageSize(opts.initialPageSize);

    this.sub.add(source$.subscribe(arr => this.data$.next(arr ?? [])));
  }

  connect(): Observable<T[]> {
    const sortChange$ = this.sort.sortChange.pipe(startWith({}));
    const pageChange$ = this.paginator.page.pipe(startWith({}));

    return combineLatest([this.data$, this.filter$, sortChange$, pageChange$]).pipe(
      map(([data, filter]) => {
        // 1) filtrar
        const term = (filter || '').trim().toLowerCase();
        const filtered = term && this.opts.filterFn
          ? data.filter(d => this.opts.filterFn!(d, term))
          : term
            ? data.filter(d => JSON.stringify(d).toLowerCase().includes(term))
            : data;

        // 2) ordenar
        const active = this.sort.active;
        const dir = (this.sort.direction || 'asc') as 'asc'|'desc';
        const sorted = active
          ? [...filtered].sort((a, b) =>
              this.opts.sortFn ? this.opts.sortFn(a, b, active, dir)
              : defaultSort(a, b, active, dir))
          : filtered;

        // 3) paginar (solo renderiza este slice)
        const start = this.paginator.pageIndex * this.paginator.pageSize;
        const end = start + this.paginator.pageSize;
        // IMPORTANT: actualizar length para el paginador
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

  setFilter(term: string) { this.filter$.next(term); }
}

// sort genérico
function defaultSort(a: any, b: any, key: string, dir: 'asc'|'desc') {
  const va = (a?.[key] ?? '').toString().toLowerCase();
  const vb = (b?.[key] ?? '').toString().toLowerCase();
  const cmp = va < vb ? -1 : va > vb ? 1 : 0;
  return dir === 'asc' ? cmp : -cmp;
}
