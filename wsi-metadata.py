import openslide
# slide_filename = 'D:\DataSets\Exact_Archive\images\exact_1_4\Breast1_HE.svs'
slide_filename = 'D:\DataSets\Exact_Archive\images\exact_1_3\deb768e5efb9d1dcbc13.svs'
# slide_filename = 'D:\DataSets\Exact_Archive\images\exact_1_3\1018715d369dd0df2fc0.svs'
# slide_filename = 'L:\Breast1\Breast-3_HE.svs'
# slide_filename = 'L:\Breast Her2.svs'
# slide_filename = 'D:\\Development\\ai-viewer\\Breast1_HER2.svs'

image = openslide.OpenSlide(slide_filename)
print(openslide.OpenSlide.detect_format(slide_filename))
image_props = image.properties

print('level_count=', image.level_count)
print('dimensions=', image.dimensions)
print('level_dimensions=', image.level_dimensions)
print('level_downsamples=', image.level_downsamples)
print('objective-power=', image_props['openslide.objective-power'])

print('MPP=', image_props['aperio.MPP'])
print('Properties=', image_props)

# print(image.associated_images)
# image.associated_images["label"].show()
# image.associated_images["macro"].show()
# image.associated_images["thumbnail"].show()