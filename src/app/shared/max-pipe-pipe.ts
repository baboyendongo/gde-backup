import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'maxPipe',
  standalone: false,
})
export class MaxPipePipe implements PipeTransform {

 transform(values: number[]): number {
    if (!values || values.length === 0) return 1;
    return Math.max(...values);
  }

}
