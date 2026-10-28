import { describe, expect, it } from 'vitest';
import { publicClothingSource } from '../../../shared/publicClothingSource.js';

const project = 'https://project.supabase.co';
describe('published clothing source boundary', () => {
  it('accepts only canonical images in this project public media buckets', () => {
    expect(publicClothingSource(`${project}/storage/v1/object/public/ootie-ootd-images/ootd/shirt.webp`, project))
      .toEqual({ bucket: 'ootie-ootd-images', path: 'ootd/shirt.webp' });
    for (const value of [
      'https://another.supabase.co/storage/v1/object/public/ootie-ootd-images/shirt.webp',
      `${project}/storage/v1/object/public/ootie-ai-private/person.jpg`,
      `${project}/storage/v1/object/public/ootie-closet-media/closet/original.jpg`,
      `${project}/storage/v1/object/sign/ootie-ootd-images/shirt.webp?token=private`,
      `${project}/storage/v1/object/public/ootie-public/../ootie-ai-private/person.jpg`,
      `${project}/storage/v1/object/public/ootie-public/%2e%2e/person.jpg`,
      `${project}/storage/v1/object/public/ootie-public/a%252fb.jpg`,
      `${project}/storage/v1/object/public/ootie-public/shirt.svg`,
      'data:image/png;base64,unsafe'
    ]) expect(publicClothingSource(value, project)).toBeNull();
  });
});
