
## Setup DZI for Sample WSI
-WSI Name: 1018715d369dd0df2fc0.svs

### Get WSI
wget https://ndownloader.figshare.com/files/16261562?private_link=a82ddb634864c24f4aee

### Convert WSI to DZI
vips dzsave 1018715d369dd0df2fc0.svs --tile-size=254 --overlap=1 --suffix .jpg CCMCT_1018715d369dd0df2fc0_DZI

### Modify gsAIViewer-DZI.html
-change "path_DZI" variable at bottom of page to new DZI file loaded into project directory
### Load WSI Annotations
1.) Launch gsAIViewer-DZI.html
2.) Click "Choose File" button and select CCMCT_1018715d369dd0df2fc0_ExactAnno_TMapp.csv
3.) Select the following data loading options
    Barcode column = barcode
    Name column = letter
    Key = name
4.) Click "Load markers"
5.) Display annotations by selecting checkbox next to "All Barcodes"
