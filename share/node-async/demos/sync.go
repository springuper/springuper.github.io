import (
    "fmt"
    "net/http"
    "io/ioutil"
)
 
func main() {
    response, _ := http.Get("http://www.10101111.com")
    defer response.Body.Close()
    body, _ := ioutil.ReadAll(response.Body)
    fmt.Println(string(body))

    fmt.Println("do other stuff")
}
